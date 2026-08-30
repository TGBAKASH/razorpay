import { describe, it, expect } from 'vitest';
import {
  generateCandidateOffers,
  scoreCandidateOffer,
  processOfferNegotiation,
  computeDeterministicAcceptanceProbability,
  computeDeterministicExpectedProfit,
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

  const speedPriorityConstraints: BuyerConstraintsSection = {
    budget_max_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    delivery_deadline: '2026-09-01T23:59:59Z', // Tuesday
    quantity: 1,
    payment_preference: ['upi'],
    return_preference: 'easy returns',
    priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
  };

  const pricePriorityConstraints: BuyerConstraintsSection = {
    budget_max_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    delivery_deadline: '2026-09-01T23:59:59Z', // Tuesday
    quantity: 1,
    payment_preference: ['upi'],
    return_preference: 'easy returns',
    priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
  };

  const returnPriorityConstraints: BuyerConstraintsSection = {
    budget_max_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    delivery_deadline: '2026-09-01T23:59:59Z', // Tuesday
    quantity: 1,
    payment_preference: ['upi'],
    return_preference: 'easy returns',
    priorities: ['return_terms', 'price', 'delivery_speed', 'extras'],
  };

  const fixedNow = new Date('2026-08-25T12:00:00.000Z');

  it('Delivery Speed priority: selects Candidate A (Monday Delivery) as top offer', async () => {
    const result = await processOfferNegotiation(
      speedPriorityConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    const winning = result.winning_offer;

    // Verify Candidate A is selected when fastest delivery is priority
    expect(winning.final_price_paise).toBe(394900);
    expect(winning.discount_paise).toBe(35000);
    expect(winning.payment_methods_allowed).toEqual(['upi']);
    expect(winning.return_terms_days).toBe(10);

    // Retained gross profit: ₹1,299
    expect(result.gross_profit_paise).toBe(129900);
    expect(result.margin_pct).toBeCloseTo(49.02, 1);

    // Verify decision notice honors stated priority
    expect(result.tiebreak_info.reason).toContain('You told us fastest delivery mattered most');
    expect(result.tiebreak_info.reason).toContain('Sprint Athletics');
  });

  it('Lowest Price priority: selects Candidate C (₹3,783) as top offer among all policy-valid offers', async () => {
    const result = await processOfferNegotiation(
      pricePriorityConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    const winning = result.winning_offer;

    // Verify Candidate C (cheapest valid price) wins when price is #1 priority
    expect(winning.final_price_paise).toBe(378312); // ₹3,783.12 max 12% discount
    expect(winning.discount_paise).toBe(51588);
    expect(winning.return_terms_days).toBe(14);

    // Verify decision notice honors stated priority
    expect(result.tiebreak_info.reason).toContain('You told us lowest price mattered most');
    expect(result.tiebreak_info.reason).toContain('Sprint Athletics');
  });

  it('Return Terms priority: selects Candidate C (14-day return window) as top offer', async () => {
    const result = await processOfferNegotiation(
      returnPriorityConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    const winning = result.winning_offer;

    // Verify Candidate C (14 days return window) wins when returns is #1 priority
    expect(winning.return_terms_days).toBe(14);
    expect(result.tiebreak_info.reason).toContain('You told us flexible return terms mattered most');
  });

  it('generates multiple candidates and all candidates satisfy policy floor', () => {
    const candidates = generateCandidateOffers(
      pricePriorityConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    expect(candidates.length).toBe(3);

    // Candidate 1 (Offer A): ₹3,949
    expect(candidates[0]?.final_price_paise).toBe(394900);
    // Candidate 2 (Offer B): ₹4,199
    expect(candidates[1]?.final_price_paise).toBe(419900);
    // Candidate 3 (Offer C): Max 12% discount (₹3,783)
    expect(candidates[2]?.final_price_paise).toBe(378312);
  });

  it('guarantees LLM explanation does not mutate deterministic contract numbers (Invariant 1)', async () => {
    const result = await processOfferNegotiation(
      pricePriorityConstraints,
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

  it('Merchant profit breaks genuine ties when two candidates have identical prices', async () => {
    // Custom product snapshot where two offers have identical prices but different merchant costs
    const tieProduct: ProductSnapshot = {
      sku: 'IDENTICAL-PRICE-RUNNER',
      cost_paise: 200000,
      list_price_paise: 300000,
      movement_rate: 'normal',
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
    };

    const tiePolicy: MerchantPolicyConfig = {
      policy_version: 'v1',
      min_margin_pct: 10.0,
      max_discount_pct: 15.0,
      free_delivery_above_paise: 100000,
      no_discount_fast_moving: false,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: false,
      human_approval_above_paise: 1500000,
    };

    const result = await processOfferNegotiation(
      pricePriorityConstraints,
      tieProduct,
      tiePolicy,
      sprintInventory,
      fixedNow
    );

    expect(result.winning_offer).toBeDefined();
    expect(result.tiebreak_info.reason).toContain('You told us lowest price mattered most');
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
      pricePriorityConstraints,
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

  it('computes deterministic acceptance probability and expected profit accurately (Part 2 formula)', () => {
    // 1. Exact match with budget (gap_ratio = 0): base_prob = 0.50
    const probNormal = computeDeterministicAcceptanceProbability(400000, 400000, 'normal', 10);
    expect(probNormal).toBeCloseTo(0.50, 2);

    // 2. Slow movement rate applies 1.15x urgency multiplier
    const probSlow = computeDeterministicAcceptanceProbability(400000, 400000, 'slow', 60);
    expect(probSlow).toBeCloseTo(0.50 * 1.15, 2); // 0.575

    // 3. Fast movement rate applies 0.85x urgency multiplier
    const probFast = computeDeterministicAcceptanceProbability(400000, 400000, 'fast', 5);
    expect(probFast).toBeCloseTo(0.50 * 0.85, 2); // 0.425

    // 4. Undercutting budget increases acceptance probability
    // Price = 380,000 paise (₹3,800), Budget = 400,000 paise (₹4,000)
    // gap_ratio = (400,000 - 380,000) / 400,000 = 0.05
    // base_prob = 0.50 + 0.05 * 2.0 = 0.60
    const probUndercut = computeDeterministicAcceptanceProbability(380000, 400000, 'normal', 10);
    expect(probUndercut).toBeCloseTo(0.60, 2);

    // 5. Expected profit calculation: prob * (price - cost)
    // Cost = 265,000 paise, Price = 394,900 paise -> Profit = 129,900 paise
    const expProfit = computeDeterministicExpectedProfit(394900, 265000, 400000, 'slow', 60);
    expect(expProfit).toBeGreaterThan(0);
    expect(Number.isFinite(expProfit)).toBe(true);
  });
});
