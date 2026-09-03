import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { sign } from '@razorpay-dealflow/contract-service';
import { defaultRazorpayClient } from '@razorpay-dealflow/razorpay-client';
import crypto from 'node:crypto';

describe('Part 2 — True Agent-Autonomous Payment (Razorpay Recurring & UPI Autopay)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('Phase 1: registers a real Razorpay recurring mandate with token object and ₹1.00 auth', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/mandates/register',
      payload: {
        buyer_agent_id: 'buyer-test-agent-01',
        name: 'Arjun Mehta',
        email: 'arjun.mehta@example.com',
        contact: '9876543210',
        max_amount_inr: 5000,
        frequency: 'as_presented',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.mandate.token_id).toMatch(/^token_/);
    expect(body.mandate.customer_id).toMatch(/^cust_/);
    expect(body.mandate.max_amount_paise).toBe(500000);
    expect(body.mandate.max_amount_inr).toBe('5000.00');
    expect(body.authorization_order.amount_paise).toBe(100); // ₹1.00 authorization charge
    expect(body.authorization_order.token_specification.max_amount).toBe(500000);
  });

  it('retrieves active buyer mandate status', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/mandates/status?buyer_agent_id=buyer-test-agent-01',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.has_active_mandate).toBe(true);
    expect(body.mandate.buyer_agent_id).toBe('buyer-test-agent-01');
    expect(body.mandate.status).toBe('active');
  });

  it('processes token.confirmed webhook signed with HMAC-SHA256', async () => {
    const newTokenId = 'token_confirmed_' + crypto.randomBytes(4).toString('hex');
    const webhookPayload = {
      entity: 'event',
      event: 'token.confirmed',
      event_id: 'evt_token_' + Date.now(),
      payload: {
        token: {
          entity: {
            id: newTokenId,
            customer_id: 'cust_confirmed_123',
            notes: {
              buyer_agent_id: 'buyer-test-agent-01',
            },
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', defaultRazorpayClient.getWebhookSecret())
      .update(rawBody, 'utf8')
      .digest('hex');

    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'x-razorpay-signature': signature,
        'content-type': 'application/json',
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('processed_token_confirmed');
    expect(body.token_id).toBe(newTokenId);
  });

  it('Phase 2: executes autonomous S2S payment using token_id with zero human clicks', async () => {
    const offerId = 'off-auto-pay-' + Math.random().toString(36).substring(2, 9);
    const agreedPricePaise = 378300; // ₹3,783.00 (within ₹5,000 ceiling)

    const contract = sign({
      offer_id: offerId,
      buyer_agent_id: 'buyer-test-agent-01',
      merchant_id: 'merchant-sprint-alpha',
      sku: 'SPRINTPRO-X2',
      quantity: 1,
      final_price_paise: agreedPricePaise,
      currency: 'INR',
      payment_methods_allowed: ['upi'],
      delivery_promise: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      return_terms_days: 10,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      policy_version: 'v1',
    });

    const res = await server.inject({
      method: 'POST',
      url: '/api/payments/autonomous-charge',
      payload: {
        buyer_agent_id: 'buyer-test-agent-01',
        signed_contract: contract,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.autonomous_payment_captured).toBe(true);
    expect(body.is_s2s_autonomous).toBe(true);
    expect(body.human_interaction_required).toBe(false);
    expect(body.payment_id).toMatch(/^pay_/);
    expect(body.order_id).toMatch(/^order_/);
    expect(body.amount_paise).toBe(agreedPricePaise);
    expect(body.amount_inr).toBe('3783.00');
    expect(body.settlement_protocol).toBe('NPCI_UAP_UPI_AUTOPAY');
  });

  it('enforces Invariant 4: rejects autonomous charge when price exceeds mandate ceiling', async () => {
    const offerId = 'off-breach-' + Math.random().toString(36).substring(2, 9);
    const overCeilingPaise = 650000; // ₹6,500.00 (exceeds ₹5,000 mandate cap)

    const contract = sign({
      offer_id: offerId,
      buyer_agent_id: 'buyer-test-agent-01',
      merchant_id: 'merchant-sprint-alpha',
      sku: 'SPRINTPRO-X2',
      quantity: 1,
      final_price_paise: overCeilingPaise,
      currency: 'INR',
      payment_methods_allowed: ['upi'],
      delivery_promise: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      return_terms_days: 10,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      policy_version: 'v1',
    });

    const res = await server.inject({
      method: 'POST',
      url: '/api/payments/autonomous-charge',
      payload: {
        buyer_agent_id: 'buyer-test-agent-01',
        signed_contract: contract,
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invariant 4 Breach');
    expect(body.order_amount_paise).toBe(overCeilingPaise);
    expect(body.mandate_ceiling_paise).toBe(500000);
  });

  it('revokes mandate and refuses subsequent autonomous charges', async () => {
    const revokeRes = await server.inject({
      method: 'POST',
      url: '/api/mandates/revoke',
      payload: { buyer_agent_id: 'buyer-test-agent-01' },
    });

    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = JSON.parse(revokeRes.body);
    expect(revokeBody.mandate.status).toBe('revoked');

    // Attempting payment now returns 412 Precondition Failed
    const offerId = 'off-post-revoke-' + Math.random().toString(36).substring(2, 9);
    const contract = sign({
      offer_id: offerId,
      buyer_agent_id: 'buyer-test-agent-01',
      merchant_id: 'merchant-sprint-alpha',
      sku: 'SPRINTPRO-X2',
      quantity: 1,
      final_price_paise: 300000,
      currency: 'INR',
      payment_methods_allowed: ['upi'],
      delivery_promise: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      return_terms_days: 10,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      policy_version: 'v1',
    });

    const chargeRes = await server.inject({
      method: 'POST',
      url: '/api/payments/autonomous-charge',
      payload: {
        buyer_agent_id: 'buyer-test-agent-01',
        signed_contract: contract,
      },
    });

    expect(chargeRes.statusCode).toBe(412);
    const chargeBody = JSON.parse(chargeRes.body);
    expect(chargeBody.error).toContain('Precondition Failed');
  });
});
