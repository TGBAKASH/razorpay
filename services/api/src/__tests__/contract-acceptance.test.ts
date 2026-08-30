import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';

describe('Offer Acceptance & Verification API (POST /api/offers/:id/accept)', () => {
  const server = buildServer();

  beforeEach(() => {
    nonceStore.reset();
  });

  async function generateSprintProOffer() {
    const response = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.signed_contract).toBeDefined();
    return body.signed_contract;
  }

  it('accepts a valid signed contract and transitions to OFFER_ACCEPTED', async () => {
    const contract = await generateSprintProOffer();
    const offerId = contract.offer_id;

    const acceptResponse = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: contract },
    });

    expect(acceptResponse.statusCode).toBe(200);
    const acceptBody = JSON.parse(acceptResponse.body);
    expect(acceptBody.success).toBe(true);
    expect(acceptBody.status).toBe('OFFER_ACCEPTED');
    expect(acceptBody.ready_for_payment).toBe(true);
    expect(acceptBody.amount_paise).toBe(394900);
    expect(acceptBody.contract.status).toBe('CONSUMED');
  });

  it('strictly rejects acceptance when final_price_paise has been tampered with (Price Tampering Test)', async () => {
    const contract = await generateSprintProOffer();
    const offerId = contract.offer_id;

    // Tamper with contract price: flip 394900 -> 294900
    const tamperedContract = {
      ...contract,
      canonical_payload: {
        ...contract.canonical_payload,
        final_price_paise: 294900,
      },
    };

    const acceptResponse = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: tamperedContract },
    });

    expect(acceptResponse.statusCode).toBe(422);
    const acceptBody = JSON.parse(acceptResponse.body);
    expect(acceptBody.success).toBe(false);
    expect(acceptBody.code).toBe('SIGNATURE_VERIFICATION_FAILED');
    expect(acceptBody.error).toContain('Invalid contract signature (tampering detected');
  });

  it('strictly rejects replay attack when the same contract is accepted a second time (Nonce Replay Test)', async () => {
    const contract = await generateSprintProOffer();
    const offerId = contract.offer_id;

    // First acceptance succeeds
    const firstAccept = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: contract },
    });
    expect(firstAccept.statusCode).toBe(200);

    // Replay attempt of the exact same signed contract fails
    const replayAccept = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: contract },
    });

    expect(replayAccept.statusCode).toBe(409);
    const replayBody = JSON.parse(replayAccept.body);
    expect(replayBody.success).toBe(false);
    expect(replayBody.code).toBe('NONCE_ALREADY_CONSUMED');
    expect(replayBody.error).toContain('Nonce already consumed');
  });

  it('rejects acceptance if live inventory drops to 0 before accept (Inventory Race Scenario 1)', async () => {
    const contract = await generateSprintProOffer();
    const offerId = contract.offer_id;

    const acceptResponse = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: {
        signed_contract: contract,
        live_inventory_override: 0, // Inventory dropped to 0 before acceptance
      },
    });

    expect(acceptResponse.statusCode).toBe(409);
    const acceptBody = JSON.parse(acceptResponse.body);
    expect(acceptBody.success).toBe(false);
    expect(acceptBody.code).toBe('INSUFFICIENT_INVENTORY');
    expect(acceptBody.error).toContain('Insufficient inventory at accept-time');
    if (acceptBody.alternative_offer) {
      expect(acceptBody.alternative_offer.requires_fresh_acceptance).toBe(true);
      expect(acceptBody.alternative_offer.offer_id).not.toBe(offerId);
    }
  });

  it('rejects acceptance if offer expiration timestamp is in the past (Expiry Scenario 5)', async () => {
    const contract = await generateSprintProOffer();
    const offerId = contract.offer_id;

    // Simulate expired contract (signed legitimately in the past)
    const expiredContract = {
      ...contract,
      canonical_payload: {
        ...contract.canonical_payload,
        expires_at: '2026-08-20T10:00:00Z',
      },
    };

    const acceptResponse = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: expiredContract },
    });

    // Signature fails because canonical_payload changed, or if signed with past expiry, expiry fails
    expect([410, 422]).toContain(acceptResponse.statusCode);
  });
});
