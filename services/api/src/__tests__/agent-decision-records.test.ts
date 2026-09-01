import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { stateMachine } from '../services/state-machine.js';

describe('Agent Decision Records (Restructured Audit Ledger)', () => {
  const server = buildServer();

  beforeEach(() => {
    nonceStore.reset();
    stateMachine.reset();
  });

  it('records structured inputs, rejected alternatives with reasons, and winning decision for single-merchant negotiation', async () => {
    // 1. Generate an offer where buyer states "Lowest Price" priority
    const res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        buyer_agent_id: 'buyer-agent-proof-01',
        buyer_constraints: {
          budget_max_paise: 400000, // ₹4,000 ceiling
          currency: 'INR',
          delivery_deadline: '2026-09-07T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed', 'return_terms'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const offerId = body.signed_contract.offer_id;

    // 2. Query audit logs for this transaction
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${offerId}`,
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = JSON.parse(auditRes.body);
    expect(auditBody.logs.length).toBeGreaterThan(0);

    // 3. Find the OFFER_GENERATED consequential decision entry
    const decisionLog = auditBody.logs.find((l: any) => l.action === 'EVALUATE_CANDIDATE_OFFERS');
    expect(decisionLog).toBeDefined();

    const record = decisionLog.decision_record || decisionLog.input_data?.decision_record;
    expect(record).toBeDefined();
    expect(record.decision_type).toBe('SINGLE_MERCHANT_OFFER');

    // Invariant: Inputs Considered
    expect(record.inputs_considered).toBeDefined();
    expect(record.inputs_considered.buyer.priorities).toEqual(['price', 'delivery_speed', 'return_terms']);
    expect(record.inputs_considered.buyer.budget_ceiling_inr).toBe('4000.00');
    expect(record.inputs_considered.buyer.quantity).toBe(1);
    expect(record.inputs_considered.merchant_policy.policy_version).toBeDefined();
    expect(record.inputs_considered.merchant_policy.min_margin_pct).toBe(18);
    expect(record.inputs_considered.merchant_policy.max_discount_pct).toBe(12);

    // Invariant: Rejected Alternatives with Specific Reasons
    expect(Array.isArray(record.alternatives_rejected)).toBe(true);
    expect(record.alternatives_rejected.length).toBeGreaterThan(0);
    for (const alt of record.alternatives_rejected) {
      expect(alt.label).toBeDefined();
      expect(alt.price_inr).toBeDefined();
      expect(['POLICY_FLOOR', 'BUYER_PRIORITY', 'RELIABILITY_FLOOR', 'INVENTORY_EXHAUSTED']).toContain(
        alt.rejection_stage
      );
      expect(alt.reason.length).toBeGreaterThan(10);
    }

    // Invariant: Final Winning Decision with Rule
    expect(record.final_decision).toBeDefined();
    expect(record.final_decision.governing_rule).toBe('RULE_BUYER_PRIORITY_LOWEST_PRICE');
    expect(record.final_decision.price_inr).toBe('3783.12');
    expect(record.final_decision.rationale).toBeDefined();
  });

  it('records structured inputs, rejected competitor bids with reasons, and winning decision for 3-merchant auction', async () => {
    const auctionRes = await server.inject({
      method: 'POST',
      url: '/api/auction/broadcast',
      payload: {
        category: 'running shoes',
        buyer_agent_id: 'buyer-agent-auction-proof',
        buyer_constraints: {
          quantity: 20,
          budget_max_paise: 3000000,
          currency: 'INR',
          delivery_deadline: '2026-09-08T23:59:59Z',
          payment_preference: ['upi', 'card'],
          return_preference: 'flexible',
          priorities: ['price', 'delivery_speed', 'return_terms'],
          min_reliability_stars: 4.0, // 4.0 Star Trust Floor
        },
      },
    });

    expect(auctionRes.statusCode).toBe(200);
    const auctionBody = JSON.parse(auctionRes.body);
    const winningOfferId = auctionBody.winning_contract.canonical_payload.offer_id;

    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${winningOfferId}`,
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = JSON.parse(auditRes.body);
    const decisionLog = auditBody.logs.find((l: any) => l.action === 'AUCTION_WINNER_SELECTED');
    expect(decisionLog).toBeDefined();

    const record = decisionLog.decision_record || decisionLog.input_data?.decision_record;
    expect(record).toBeDefined();
    expect(record.decision_type).toBe('AUCTION_BID_SELECTION');
    expect(record.inputs_considered.buyer.min_reliability_stars).toBe(4.0);

    // Verify rejected alternative bids contains floor exclusions and price loss reasons
    expect(record.alternatives_rejected.length).toBe(2);
    const excludedBid = record.alternatives_rejected.find(
      (a: any) => a.rejection_stage === 'RELIABILITY_FLOOR'
    );
    expect(excludedBid).toBeDefined();
    expect(excludedBid.reason).toContain('reliability');

    expect(record.final_decision.governing_rule).toBe('RULE_RELIABILITY_WEIGHTED_AUCTION_UTILITY');
  });
});
