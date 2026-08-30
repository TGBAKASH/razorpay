import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { buildServer } from '../index.js';
import { defaultRazorpayClient } from '@razorpay-dealflow/razorpay-client';
import { orderStore, processedWebhookEvents } from '../routes/razorpay.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { stateMachine } from '../services/state-machine.js';

describe('Razorpay Integration & Idempotent Webhook Handler (GEMINI.md Part 3 & 5)', () => {
  const server = buildServer();
  const webhookSecret = defaultRazorpayClient.getWebhookSecret();

  beforeEach(() => {
    stateMachine.reset();
    orderStore.clear();
    processedWebhookEvents.clear();
    nonceStore.reset();
  });

  async function createSprintProOrder() {
    // 1. Generate signed offer
    const offerRes = await server.inject({
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

    const offerBody = JSON.parse(offerRes.body);
    const contract = offerBody.signed_contract;

    // 2. Accept offer (OFFER_ACCEPTED)
    await server.inject({
      method: 'POST',
      url: `/api/offers/${contract.offer_id}/accept`,
      payload: { signed_contract: contract },
    });

    // 3. Create Razorpay order bound to verified contract (ORDER_CREATED)
    const orderRes = await server.inject({
      method: 'POST',
      url: '/api/orders/create',
      payload: {
        offer_id: contract.offer_id,
        signed_contract: contract,
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const orderBody = JSON.parse(orderRes.body);
    expect(orderBody.success).toBe(true);
    expect(orderBody.order.amount).toBe(394900); // Exact integer paise (₹3,949)
    return { contract, order: orderBody.order };
  }

  it('creates a Razorpay order matching exact contract amount (Invariant 2)', async () => {
    const { order } = await createSprintProOrder();
    expect(order.id).toBeDefined();
    expect(order.amount).toBe(394900);
    expect(order.currency).toBe('INR');
  });

  it('handles valid payment.captured webhook, passes amount cross-check, and flips order to PAID', async () => {
    const { order } = await createSprintProOrder();

    const webhookPayload = {
      entity: 'event',
      event: 'payment.captured',
      event_id: 'evt_test_payment_success_001',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_sprintpro_001',
            order_id: order.id,
            amount: 394900, // Exactly matches contract
            status: 'captured',
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const webhookRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'x-razorpay-signature': signature,
        'content-type': 'application/json',
      },
      payload: rawBody,
    });

    expect(webhookRes.statusCode).toBe(200);
    const resBody = JSON.parse(webhookRes.body);
    expect(resBody.status).toBe('processed_paid');
    expect(resBody.order_id).toBe(order.id);

    // Verify stored order flipped to 'paid'
    const storedOrder = orderStore.get(order.id);
    expect(storedOrder?.status).toBe('paid');
    expect(storedOrder?.payment_id).toBe('pay_test_sprintpro_001');
  });

  it('ensures webhook handler is idempotent: replaying the same webhook payload short-circuits without double-processing', async () => {
    const { order } = await createSprintProOrder();

    const webhookPayload = {
      entity: 'event',
      event: 'payment.captured',
      event_id: 'evt_idempotent_test_unique_002',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_idempotent_002',
            order_id: order.id,
            amount: 394900,
            status: 'captured',
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // First delivery -> Processed successfully
    const firstRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });
    expect(firstRes.statusCode).toBe(200);
    expect(JSON.parse(firstRes.body).status).toBe('processed_paid');

    // Second delivery of exact same webhook -> Short-circuited and ignored
    const secondRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });
    expect(secondRes.statusCode).toBe(200);
    const secondBody = JSON.parse(secondRes.body);
    expect(secondBody.status).toBe('ignored_duplicate');
    expect(secondBody.event_id).toBe('evt_idempotent_test_unique_002');
  });

  it('marks order FLAGGED (never PAID) when webhook amount mismatches contract (Security Tampering Alert)', async () => {
    const { order } = await createSprintProOrder();

    // Mismatched amount: received 294,900 paise instead of contracted 394,900 paise
    const tamperedPayload = {
      entity: 'event',
      event: 'payment.captured',
      event_id: 'evt_tampered_amount_003',
      payload: {
        payment: {
          entity: {
            id: 'pay_tampered_003',
            order_id: order.id,
            amount: 294900, // 100,000 paise mismatch!
            status: 'captured',
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(tamperedPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const webhookRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });

    expect(webhookRes.statusCode).toBe(200);
    const resBody = JSON.parse(webhookRes.body);
    expect(resBody.status).toBe('flagged_mismatch');

    // Confirm stored order status is FLAGGED, NOT PAID
    const storedOrder = orderStore.get(order.id);
    expect(storedOrder?.status).toBe('flagged');
  });

  it('processes refund endpoint and transitions order to REFUNDED', async () => {
    const { order } = await createSprintProOrder();

    // First pay the order to reach PAID state
    const webhookPayload = {
      entity: 'event',
      event: 'payment.captured',
      event_id: `evt_refund_prep_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: 'pay_for_refund_001',
            order_id: order.id,
            amount: 394900,
            status: 'captured',
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });

    // Now trigger dispute refund from PAID state -> transitions to REFUNDED
    const refundRes = await server.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/refund`,
      payload: { reason: 'Dispute resolved by human merchant agent' },
    });

    expect(refundRes.statusCode).toBe(200);
    const refundBody = JSON.parse(refundRes.body);
    expect(refundBody.success).toBe(true);
    expect(refundBody.order.status).toBe('refunded');
  });

  it('handles refund.processed webhook event directly from gateway, updating order status to refunded', async () => {
    const { order } = await createSprintProOrder();

    const refundWebhookPayload = {
      entity: 'event',
      event: 'refund.processed',
      event_id: 'evt_refund_processed_live_001',
      payload: {
        refund: {
          entity: {
            id: 'rfd_live_test_001',
            payment_id: 'pay_test_sprintpro_001',
            amount: 394900,
            status: 'processed',
            notes: {
              order_id: order.id,
            },
          },
        },
        payment: {
          entity: {
            id: 'pay_test_sprintpro_001',
            order_id: order.id,
            amount: 394900,
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(refundWebhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const webhookRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });

    expect(webhookRes.statusCode).toBe(200);
    const resBody = JSON.parse(webhookRes.body);
    expect(resBody.status).toBe('processed_refund');
    expect(resBody.event_id).toBe('evt_refund_processed_live_001');

    const storedOrder = orderStore.get(order.id);
    expect(storedOrder?.status).toBe('refunded');
  });
});
