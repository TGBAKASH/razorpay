import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { buildServer } from '../index.js';
import { stateMachine } from '../services/state-machine.js';
import { defaultRazorpayClient } from '@razorpay-dealflow/razorpay-client';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { orderStore, processedWebhookEvents } from '../routes/razorpay.js';

describe('State Machine Enforcer & Complete Audit Trail (GEMINI.md Part 3 & 4)', () => {
  const server = buildServer();
  const webhookSecret = defaultRazorpayClient.getWebhookSecret();

  beforeEach(() => {
    stateMachine.reset();
    orderStore.clear();
    processedWebhookEvents.clear();
    nonceStore.reset();
  });

  it('strictly enforces transition graph and rejects illegal state jumps', () => {
    const offerId = 'test-jump-offer-001';
    stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');

    // Attempting to jump directly from REQUEST_RECEIVED to PAID must fail
    expect(() => {
      stateMachine.transition(offerId, 'PAID', {
        action: 'ILLEGAL_JUMP_ATTEMPT',
        actor: 'attacker_agent',
        input_data: {},
        reason: 'Attempting to jump directly to PAID',
      });
    }).toThrow(/Illegal state transition rejected: Cannot jump from "REQUEST_RECEIVED" to "PAID"/);

    // Confirm the rejection was recorded in the audit trail
    const auditEntries = stateMachine.getAuditTrail(offerId);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]?.action).toContain('REJECTED_TRANSITION');
    expect(auditEntries[0]?.reason).toContain('Cannot jump');
  });

  it('runs SprintPro X2 example end-to-end to PAID and verifies every what/who/why field is populated', async () => {
    // 1. Generate Offer
    const genRes = await server.inject({
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

    expect(genRes.statusCode).toBe(200);
    const genBody = JSON.parse(genRes.body);
    const contract = genBody.signed_contract;
    const offerId = contract.offer_id;

    // 2. Accept Offer
    const acceptRes = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/accept`,
      payload: { signed_contract: contract },
    });
    expect(acceptRes.statusCode).toBe(200);

    // 3. Create Order
    const orderRes = await server.inject({
      method: 'POST',
      url: '/api/orders/create',
      payload: { offer_id: offerId, signed_contract: contract },
    });
    expect(orderRes.statusCode).toBe(201);
    const orderBody = JSON.parse(orderRes.body);
    const orderId = orderBody.order.id;

    // 4. Capture Payment via Webhook
    const webhookPayload = {
      entity: 'event',
      event: 'payment.captured',
      event_id: `evt_sprintpro_paid_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: `pay_sprintpro_${Date.now()}`,
            order_id: orderId,
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

    const webhookRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
      payload: rawBody,
    });
    expect(webhookRes.statusCode).toBe(200);

    // 5. Query Audit Trail for this offer
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${offerId}`,
    });
    expect(auditRes.statusCode).toBe(200);
    const auditTrail = JSON.parse(auditRes.body).logs;

    // Must have at least 5 chronological steps:
    // OFFER_GENERATED -> POLICY_APPROVED -> OFFER_ACCEPTED -> ORDER_CREATED -> PAYMENT_ATTEMPTED -> PAID
    expect(auditTrail.length).toBeGreaterThanOrEqual(5);

    // Confirm that every single entry has all what/who/why fields populated and non-blank!
    for (const entry of auditTrail) {
      // What happened
      expect(entry.action).toBeDefined();
      expect(entry.action.trim().length).toBeGreaterThan(0);

      // Who/what initiated it
      expect(entry.actor).toBeDefined();
      expect(entry.actor.trim().length).toBeGreaterThan(0);

      // What data was used
      expect(entry.input_data).toBeDefined();
      expect(typeof entry.input_data).toBe('object');
      expect(Object.keys(entry.input_data).length).toBeGreaterThan(0);

      // Which policy_version approved it
      expect(entry.policy_version).toBeDefined();
      expect(entry.policy_version.trim().length).toBeGreaterThan(0);

      // Which specific rule was checked
      expect(entry.policy_checked).toBeDefined();
      expect(entry.policy_checked.trim().length).toBeGreaterThan(0);

      // Why this particular offer/decision was selected over alternatives
      expect(entry.reason).toBeDefined();
      expect(entry.reason.trim().length).toBeGreaterThan(10);

      // Valid timestamp
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
    }

    // Verify order creation entry contains raw Razorpay request/response
    const orderCreatedEntry = auditTrail.find((e: any) => e.to_state === 'ORDER_CREATED');
    expect(orderCreatedEntry?.razorpay_request).toBeDefined();
    expect(orderCreatedEntry?.razorpay_response).toBeDefined();
    expect(orderCreatedEntry?.razorpay_response.id).toBe(orderId);

    // Verify payment settled entry contains raw Razorpay response
    const paidEntry = auditTrail.find((e: any) => e.to_state === 'PAID');
    expect(paidEntry?.razorpay_response).toBeDefined();
    expect(paidEntry?.razorpay_response.status).toBe('captured');
  });

  it('handles APPROVAL_PENDING branch and releases to POLICY_APPROVED upon human approval', async () => {
    const offerId = 'offer-high-value-001';

    // 1. Initial generation -> routes to APPROVAL_PENDING
    stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
    stateMachine.transition(offerId, 'OFFER_GENERATED', {
      action: 'OFFER_GENERATED_HIGH_VALUE',
      actor: 'buyer_agent:enterprise-01',
      input_data: { quantity: 10, total_paise: 3949000 },
      reason: 'Bulk corporate order exceeding autonomous threshold (₹39,490 > ₹15,000).',
    });

    stateMachine.transition(offerId, 'APPROVAL_PENDING', {
      action: 'ROUTED_TO_APPROVAL_PENDING',
      actor: 'system:policy_engine',
      input_data: { threshold_paise: 1500000, total_paise: 3949000 },
      policy_checked: 'RULE_HUMAN_APPROVAL_THRESHOLD',
      reason: 'Order total exceeds ₹15,000 threshold. Routing to human merchant dashboard.',
    });

    expect(stateMachine.getCurrentState(offerId)).toBe('APPROVAL_PENDING');

    // 2. Cannot jump directly to OFFER_ACCEPTED from APPROVAL_PENDING
    expect(() => {
      stateMachine.transition(offerId, 'OFFER_ACCEPTED', {
        action: 'BYPASS_ATTEMPT',
        actor: 'buyer_agent',
        input_data: {},
        reason: 'Attempting to accept unapproved high-value offer',
      });
    }).toThrow();

    // 3. Named human approver authorizes offer -> transitions to POLICY_APPROVED
    const approvalEntry = stateMachine.transition(offerId, 'POLICY_APPROVED', {
      action: 'HUMAN_APPROVAL_GRANTED',
      actor: 'human:merchant_director_shreya',
      input_data: { approver: 'shreya', notes: 'Approved bulk discount for corporate partner' },
      policy_checked: 'RULE_HUMAN_APPROVAL_THRESHOLD_OVERRIDE',
      reason: 'Human approver Shreya manually authorized high-value order.',
    });

    expect(approvalEntry.to_state).toBe('POLICY_APPROVED');
    expect(approvalEntry.actor).toBe('human:merchant_director_shreya');
    expect(stateMachine.getCurrentState(offerId)).toBe('POLICY_APPROVED');
  });
});
