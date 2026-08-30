import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { stateMachine } from '../services/state-machine.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { processedWebhookEvents } from '../routes/razorpay.js';

describe('Failure Modes & Edge Cases (Phase 11 - The 8 Triggerable Demo Scenarios)', () => {
  const server = buildServer();

  beforeEach(() => {
    stateMachine.reset();
    nonceStore.reset();
    processedWebhookEvents.clear();
  });

  it('Scenario 1 (Inventory race): catches live inventory drop at accept-time, offers alternative within mandate, clean expiry with zero charge', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 1 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(1);
    expect(result.state_transition.to).toBe('EXPIRED');
    expect(result.actual_result).toContain('zero charge');
    expect(result.audit_entry.action).toBe('ACCEPT_REJECTED_INVENTORY_RACE');
    expect(result.audit_entry.policy_checked).toBe('RULE_INVENTORY_AVAILABLE');
    expect(result.details.alternativeProposal).toBeDefined();
  });

  it('Scenario 2 (Offer tampering): catches modified final_price_paise via HMAC verification failure before any Razorpay call', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 2 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(2);
    expect(result.details.verification.valid).toBe(false);
    expect(result.audit_entry.action).toBe('ACCEPT_REJECTED_SIGNATURE_INVALID');
  });

  it('Scenario 3 (Payment failure): offers alternative payment rails with terms strictly unchanged, no win-back discounts', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 3 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(3);
    expect(result.state_transition.to).toBe('FAILED');
    expect(result.details.retryOffer.final_price_paise).toBe(394900); // Terms unchanged
    expect(result.details.retryOffer.win_back_discount_applied).toBe(false);
    expect(result.audit_entry.action).toBe('WEBHOOK_PAYMENT_FAILED');
  });

  it('Scenario 4 (Buyer exceeds mandate): rejects accept request exceeding buyer budget mandate even if merchant would honor it', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 4 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(4);
    expect(result.audit_entry.action).toBe('BUYER_MANDATE_REJECTION');
    expect(result.audit_entry.policy_checked).toBe('RULE_BUYER_BUDGET_MANDATE');
  });

  it('Scenario 5 (Offer expiry): rejects accept request past expires_at with distinct OFFER_EXPIRED error', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 5 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(5);
    expect(result.state_transition.to).toBe('EXPIRED');
    expect(result.audit_entry.action).toBe('ACCEPT_REJECTED_OFFER_EXPIRED');
    expect(result.details.error_code).toBe('OFFER_EXPIRED');
  });

  it('Scenario 6 (Delivery promise impossible): catches warehouse SLA breach at accept-time, expires cleanly without charge', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 6 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(6);
    expect(result.state_transition.to).toBe('EXPIRED');
    expect(result.audit_entry.action).toBe('ACCEPT_REJECTED_DELIVERY_UNREACHABLE');
    expect(result.audit_entry.policy_checked).toBe('RULE_DELIVERY_REACHABLE');
  });

  it('Scenario 7 (LLM out-of-policy discount proposal): deterministic policy engine rejects proposal, NEVER reaches contract signing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 7 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(7);
    expect(result.details.evalResult.pass).toBe(false);
    expect(result.details.evalResult.status).toBe('POLICY_REJECTED');
    expect(result.audit_entry.action).toBe('POLICY_EVALUATION_REJECTED');
  });

  it('Scenario 8 (Duplicate webhook replay): idempotency guard short-circuits duplicate event, zero duplicate state transitions', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 8 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(8);
    expect(result.details.current_state).toBe('PAID');
    expect(result.audit_entry.action).toBe('WEBHOOK_DUPLICATE_IGNORED');
    expect(result.audit_entry.policy_checked).toBe('RULE_WEBHOOK_IDEMPOTENCY');
  });

  it('Scenario 9 (Buyer Priority Actually Wins): cheapest policy-valid candidate (Candidate C @ ₹3,783) wins over higher profit Candidate A', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 9 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(9);
    expect(result.details.winning_price_paise).toBe(378312);
    expect(result.details.provably_valid).toBe(true);
    expect(result.audit_entry.action).toBe('OFFER_GEN_BUYER_PRIORITY_WIN');
  });

  it('Scenario 10 (Same Offer, Different Product): recommends 8.1% clearance for slow mover and 0% discount for fast mover', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-scenario',
      payload: { scenario_id: 10 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    expect(result.passed).toBe(true);
    expect(result.scenario_id).toBe(10);
    expect(result.details.slow_mover.offered_price_inr).toBe('3949.00');
    expect(result.details.fast_mover.offered_price_inr).toBe('4299.00');
    expect(result.audit_entry.action).toBe('OFFER_GEN_INVENTORY_SIGNAL_DIFFERENTIATION');
  });

  it('Batch execution endpoint POST /api/demo/trigger-all runs all 10 scenarios and confirms 100% pass rate', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/trigger-all',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.all_passed).toBe(true);
    expect(body.results).toHaveLength(10);
  });
});
