import { describe, it, expect, beforeEach } from 'vitest';
import {
  sign,
  verify,
  canonicalizeJson,
  nonceStore,
  type ContractPayload,
} from '../index.js';

describe('Contract Service (GEMINI.md Part 3)', () => {
  const samplePayload: Omit<ContractPayload, 'nonce'> = {
    offer_id: 'offer-sprintpro-001',
    buyer_agent_id: 'buyer-agent-sim-01',
    merchant_id: 'merchant-sprint-alpha',
    sku: 'SPRINTPRO-X2',
    quantity: 1,
    final_price_paise: 394900, // ₹3,949
    currency: 'INR',
    payment_methods_allowed: ['upi'],
    delivery_promise: '2026-08-31T23:59:59Z',
    return_terms_days: 10,
    expires_at: '2026-08-25T21:30:00Z',
    policy_version: 'v1',
  };

  beforeEach(() => {
    nonceStore.reset();
  });

  it('produces deterministic canonical JSON regardless of object key order', () => {
    const objA = { z: 1, a: 2, m: { y: 'test', b: 10 } };
    const objB = { a: 2, m: { b: 10, y: 'test' }, z: 1 };

    const canonicalA = canonicalizeJson(objA);
    const canonicalB = canonicalizeJson(objB);

    expect(canonicalA).toBe(canonicalB);
    expect(canonicalA).toBe('{"a":2,"m":{"b":10,"y":"test"},"z":1}');
  });

  it('signs a contract payload and successfully verifies it with matching secret', () => {
    const signedContract = sign(samplePayload);

    expect(signedContract.signature).toBeDefined();
    expect(signedContract.nonce).toBeDefined();
    expect(signedContract.status).toBe('POLICY_APPROVED');

    const verification = verify(signedContract);
    expect(verification.valid).toBe(true);
    expect(verification.contract).toBeDefined();
  });

  it('strictly rejects verification when one digit of final_price_paise is flipped (Anti-Tampering Test)', () => {
    // 1. Validly sign the contract with price ₹3,949 (394,900 paise)
    const signedContract = sign(samplePayload);
    expect(verify(signedContract).valid).toBe(true);

    // 2. Tamper with final_price_paise (e.g. buyer or compromised client changes price to ₹2,949 = 294,900 paise)
    const tamperedContract = {
      ...signedContract,
      canonical_payload: {
        ...signedContract.canonical_payload,
        final_price_paise: 294900, // Flipped from 394900 to 294900
      },
    };

    // 3. Confirm verify() detects tampering and rejects
    const tamperedVerification = verify(tamperedContract);
    expect(tamperedVerification.valid).toBe(false);
    expect(tamperedVerification.reason).toContain('Invalid contract signature (tampering detected');
  });

  it('strictly rejects verification when quantity or SKU is modified', () => {
    const signedContract = sign(samplePayload);

    const tamperedQty = {
      ...signedContract,
      canonical_payload: {
        ...signedContract.canonical_payload,
        quantity: 5, // Flipped from 1 to 5
      },
    };

    expect(verify(tamperedQty).valid).toBe(false);
  });

  it('proves a consumed nonce cannot be replayed into a second accept action (Anti-Replay Test)', () => {
    const signedContract = sign(samplePayload);
    const nonce = signedContract.nonce;

    // 1. Initial state: Nonce is unused
    expect(nonceStore.isNonceConsumed(nonce)).toBe(false);

    // 2. First consumption: Succeeds
    const firstConsume = nonceStore.consumeNonce(nonce, signedContract.offer_id);
    expect(firstConsume).toBe(true);
    expect(nonceStore.isNonceConsumed(nonce)).toBe(true);

    // 3. Second consumption attempt (Replay attack): Strictly rejected
    const replayAttempt = nonceStore.consumeNonce(nonce, signedContract.offer_id);
    expect(replayAttempt).toBe(false);
  });
});
