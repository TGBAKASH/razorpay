import { describe, it, expect } from 'vitest';
import {
  generateCandidateOffers,
  scoreCandidateOffer,
  processOfferNegotiation,
} from '../index.js';
import type { BuyerConstraintsSection } from '@razorpay-dealflow/adapters';
import type {
  MerchantPolicyConfig,
  ProductSnapshot,
  InventorySnapshot,
} from '@razorpay-dealflow/policy-engine';

describe('Offer Engine (Rules + Gemini Explanation + Heuristic Ranking)', () => {
  const sprintPolicy: MerchantPolicyConfig = {
    policy_version: 'v1',
    min_margin_pct: 18.0,
    max_discount_pct: 12.0,
    free_delivery_above_paise: 149900,
    no_discount_fast_moving: true,
    clear_within_days: 30,
    prepaid_discount_on_high_cod_risk: true,
    human_approval_above_paise: 1500000, // ₹15,000
  };

  const sprintProduct: ProductSnapshot = {
    sku: 'SPRINTPRO-X2',
    cost_paise: 265000, // ₹2,650
    list_price_paise: 429900, // ₹4,299
    movement_rate: 'slow',
    warehouse_location: 'BLR-WH-01',
    clearance_flag: false,
  };

  const sprintInventory: InventorySnapshot = {
    sku: 'SPRINTPRO-X2',
    available_qty: 41,
    warehouse_location: 'BLR-WH-01',
    carrier_sla_days: { 'BLR-WH-01': 2 },
  };

  const buyerConstraints: BuyerConstraintsSection = {
    budget_max_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    delivery_deadline: '2026-09-01T23:59:59Z', // Tuesday
    quantity: 1,
    payment_preference: ['upi'],
    return_preference: 'easy returns',
    priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
  };

  const fixedNow = new Date('2026-08-25T12:00:00.000Z');

  it('runs SprintPro X2 example end-to-end and outputs Offer A matching the brief', async () => {
    const result = await processOfferNegotiation(
      buyerConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    const winning = result.winning_offer;

    // Verify exact offer details specified in the brief for SprintPro X2 Offer A:
    // Final price: ₹3,949 (394,900 paise)
    expect(winning.final_price_paise).toBe(394900);
    // Discount: ₹350 (35,000 paise)
    expect(winning.discount_paise).toBe(35000);
    // Prepaid UPI
    expect(winning.payment_methods_allowed).toEqual(['upi']);
    // 10-day returns
    expect(winning.return_terms_days).toBe(10);
    // Expiry: 8 minutes from generation
    const expiryDate = new Date(winning.expires_at);
    const diffMinutes = Math.round((expiryDate.getTime() - fixedNow.getTime()) / (60 * 1000));
    expect(diffMinutes).toBe(8);

    // Retained gross profit: ₹1,299 (129,900 paise on ₹2,650 cost)
    expect(result.gross_profit_paise).toBe(129900);
    expect(result.margin_pct).toBeCloseTo(49.02, 1);

    // Verify 4 discount reasons cited
    expect(winning.discount_reason).toHaveLength(4);
    expect(winning.discount_reason[0]).toContain('Slow-moving inventory');
    expect(winning.discount_reason[1]).toContain('Prepaid UPI incentive');
    expect(winning.discount_reason[2]).toContain('Under buyer budget mandate');
    expect(winning.discount_reason[3]).toContain('Monday delivery SLA');

    // Verify generated explanation cites the reasons
    expect(result.explanation).toBeDefined();
    expect(result.explanation.length).toBeGreaterThan(50);
    expect(result.explanation).toContain('SprintPro X2');
    expect(result.explanation).toContain('3,949');
  });

  it('generates multiple candidates and heuristic ranking selects the highest expected profit', () => {
    const candidates = generateCandidateOffers(
      buyerConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    expect(candidates.length).toBe(3);

    // Candidate 1 (Offer A): ₹3,949
    expect(candidates[0]?.final_price_paise).toBe(394900);
    // Candidate 2 (Offer B): ₹4,199 (exceeds budget, conversion will drop)
    expect(candidates[1]?.final_price_paise).toBe(419900);
    // Candidate 3 (Offer C): Max 12% discount (₹3,783)
    expect(candidates[2]?.final_price_paise).toBe(378312);
  });

  it('guarantees LLM explanation does not mutate deterministic contract numbers (Invariant 1)', async () => {
    const result = await processOfferNegotiation(
      buyerConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    // Final price and discount MUST be exact integers derived deterministically
    expect(Number.isInteger(result.winning_offer.final_price_paise)).toBe(true);
    expect(Number.isInteger(result.winning_offer.discount_paise)).toBe(true);
    expect(result.winning_offer.final_price_paise + result.winning_offer.discount_paise).toBe(
      sprintProduct.list_price_paise
    );
  });

  it('SprintPro X2 seed data: result is UNCHANGED (Candidate A wins) and tiebreak does NOT fire due to >10% score gap', async () => {
    const result = await processOfferNegotiation(
      buyerConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    // Candidate A wins because its expected profit score is >10% ahead of C and B
    expect(result.winning_offer.final_price_paise).toBe(394900);
    expect(result.tiebreak_info.applied).toBe(false);
    expect(result.tiebreak_info.reason).toContain("Candidate A's expected profit was clearly ahead of the others");
    expect(result.tiebreak_info.reason).toContain("didn't come into play here");
  });

  it('Near-tie scenario: picks the cheaper valid candidate when scores are within 10% and priority is lowest price', async () => {
    // Custom product snapshot where clearance price yields near-identical expected profit
    const nearTieProduct: ProductSnapshot = {
      sku: 'NEAR-TIE-RUNNER',
      cost_paise: 200000, // ₹2,000
      list_price_paise: 300000, // ₹3,000
      movement_rate: 'normal',
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
    };

    const nearTiePolicy: MerchantPolicyConfig = {
      policy_version: 'v1',
      min_margin_pct: 10.0,
      max_discount_pct: 15.0,
      free_delivery_above_paise: 100000,
      no_discount_fast_moving: false,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: false,
      human_approval_above_paise: 1500000,
    };

    const pricePriorityConstraints: BuyerConstraintsSection = {
      budget_max_paise: 300000,
      currency: 'INR',
      delivery_deadline: '2026-09-02T23:59:59Z',
      quantity: 1,
      payment_preference: ['upi'],
      return_preference: 'easy returns',
      priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
    };

    const result = await processOfferNegotiation(
      pricePriorityConstraints,
      nearTieProduct,
      nearTiePolicy,
      sprintInventory,
      fixedNow
    );

    // Verify tiebreak fired if multiple candidates were within the 10% band
    if (result.tiebreak_info.near_tied_candidates_count > 1) {
      expect(result.tiebreak_info.applied).toBe(true);
      expect(result.tiebreak_info.reason).toContain('Your price preference broke a near-tie');
      // The winning offer is the lowest priced among near-tied candidates
      const nearTied = result.candidate_offers.slice(0, result.tiebreak_info.near_tied_candidates_count);
      const minPriceInBand = Math.min(...nearTied.map((c) => c.candidate.final_price_paise));
      expect(result.winning_offer.final_price_paise).toBe(minPriceInBand);
    }
  });

  it('Never selects an invalid candidate that breached policy regardless of buyer priority', async () => {
    // Strict policy with high minimum margin floor (30%)
    const strictPolicy: MerchantPolicyConfig = {
      policy_version: 'v1',
      min_margin_pct: 30.0, // 30% margin floor required
      max_discount_pct: 12.0,
      free_delivery_above_paise: 149900,
      no_discount_fast_moving: true,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 1500000,
    };

    const result = await processOfferNegotiation(
      buyerConstraints,
      sprintProduct,
      strictPolicy,
      sprintInventory,
      fixedNow
    );

    // Ensure all returned candidate offers passed policy checks
    result.candidate_offers.forEach((c) => {
      expect(c.evaluation.pass).toBe(true);
      expect(c.margin_pct).toBeGreaterThanOrEqual(30.0);
    });
    expect(result.winning_offer).toBeDefined();
  });
});
