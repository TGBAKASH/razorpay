import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  RazorpayClientWrapper,
  createRazorpayClientWrapper,
} from '../index.js';
import { sign, type ContractPayload } from '@razorpay-dealflow/contract-service';

describe('Razorpay Client Wrapper (Test Mode & Verification)', () => {
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

  const client = createRazorpayClientWrapper({
    keyId: 'rzp_test_sample123',
    keySecret: 'secret_sample123',
    webhookSecret: 'webhook_sec_123',
  });

  it('strictly prohibits live keys and throws security violation (Invariant 6)', () => {
    expect(() => {
      new RazorpayClientWrapper({
        keyId: 'rzp_live_compromised_key_123',
      });
    }).toThrow(/CRITICAL SECURITY VIOLATION: Live Razorpay keys detected/);
  });

  it('creates an order matching exact contract amount in integer paise (Invariant 2)', async () => {
    const signedContract = sign(samplePayload);
    const order = await client.createOrder(signedContract);

    expect(order.id).toBeDefined();
    expect(order.amount).toBe(394900); // Exactly 394,900 paise
    expect(order.currency).toBe('INR');
    expect(order.notes.offer_id).toBe('offer-sprintpro-001');
    expect(order.notes.sku).toBe('SPRINTPRO-X2');
  });

  it('verifies valid HMAC-SHA256 webhook signature', () => {
    const rawBody = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', amount: 394900 } } },
    });

    const signature = crypto
      .createHmac('sha256', 'webhook_sec_123')
      .update(rawBody, 'utf8')
      .digest('hex');

    const isValid = client.verifyWebhookSignature(rawBody, signature, 'webhook_sec_123');
    expect(isValid).toBe(true);
  });

  it('rejects tampered webhook payload signature', () => {
    const rawBody = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', amount: 394900 } } },
    });

    const signature = crypto
      .createHmac('sha256', 'webhook_sec_123')
      .update(rawBody, 'utf8')
      .digest('hex');

    // Tamper with the raw body content
    const tamperedBody = rawBody.replace('394900', '294900');
    const isValid = client.verifyWebhookSignature(tamperedBody, signature, 'webhook_sec_123');
    expect(isValid).toBe(false);
  });

  it('processes test refund successfully', async () => {
    const refund = await client.processRefund('pay_12345', 394900, { reason: 'dispute_resolution' });
    expect(refund.id).toBeDefined();
    expect(refund.amount).toBe(394900);
    expect(refund.status).toBe('processed');
    expect(refund.payment_id).toBe('pay_12345');
  });
});
