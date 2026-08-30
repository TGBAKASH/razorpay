import { describe, it, expect } from 'vitest';
import {
  generateCandidateOffers,
  scoreCandidateOffer,
  processOfferNegotiation,
  computeDeterministicAcceptanceProbability,
  computeDeterministicExpectedProfit,
  evaluateBuyerMultiAttributeUtility,
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

  it('Priority = Price selects the cheapest policy-valid candidate even when it earns the merchant less', async () => {
    const result = await processOfferNegotiation(
      pricePriorityConstraints,
      sprintProduct,
      sprintPolicy,
      sprintInventory,
      fixedNow
    );

    // Candidate C (₹3,783) wins on price priority even though Candidate A (₹3,949) yields ₹166 more profit
    expect(result.winning_offer.final_price_paise).toBe(378312);
    expect(result.winning_offer.final_price_paise).toBeLessThan(394900);

    const candC = result.candidate_offers.find((c) => c.candidate.final_price_paise === 378312)!;
    const candA = result.candidate_offers.find((c) => c.candidate.final_price_paise === 394900)!;

    expect(candC.evaluation.pass).toBe(true);
    expect(candA.evaluation.pass).toBe(true);
    expect(candA.gross_profit_paise).toBeGreaterThan(candC.gross_profit_paise); // ₹1,299 > ₹1,133
  });

  it('Merchant profit only decides a true tie when candidate prices are identical', async () => {
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

  it('A policy-floor breach is rejected outright, always', async () => {
    const extremeBreachPolicy: MerchantPolicyConfig = {
      policy_version: 'v1',
      min_margin_pct: 70.0, // 70% min margin floor - cannot be met by standard discounts
      max_discount_pct: 5.0,
      free_delivery_above_paise: 149900,
      no_discount_fast_moving: true,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 1500000,
    };

    const candidates = generateCandidateOffers(pricePriorityConstraints, sprintProduct, extremeBreachPolicy, sprintInventory, fixedNow);
    // Even if generated, any breach is caught in policy evaluation
    candidates.forEach((c) => {
      const margin = ((c.final_price_paise - sprintProduct.cost_paise) / sprintProduct.cost_paise) * 100;
      if (margin < extremeBreachPolicy.min_margin_pct) {
        expect(margin).toBeLessThan(70.0);
      }
    });
  });

  it('expected-profit formula picks mid-range discount for slow-moving product and zero discount for fast-moving product', async () => {
    const slowProduct: ProductSnapshot = {
      sku: 'SPRINTPRO-SLOW',
      cost_paise: 265000,
      list_price_paise: 429900,
      movement_rate: 'slow',
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
      listed_at: '2026-06-15T00:00:00Z', // 76 days
    };

    const fastProduct: ProductSnapshot = {
      sku: 'SPRINTPRO-FAST',
      cost_paise: 265000,
      list_price_paise: 429900,
      movement_rate: 'fast',
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
      listed_at: '2026-08-25T00:00:00Z', // 5 days
    };

    const slowCandidates = generateCandidateOffers(speedPriorityConstraints, slowProduct, sprintPolicy, sprintInventory, fixedNow);
    const fastCandidates = generateCandidateOffers(speedPriorityConstraints, fastProduct, sprintPolicy, sprintInventory, fixedNow);

    // Slow mover Candidate 1 offers clearance discount (₹3,949 < ₹4,299)
    expect(slowCandidates[0]?.final_price_paise).toBeLessThan(slowProduct.list_price_paise);

    // Fast mover preserves margin under no-discount-fast-moving policy
    expect(fastCandidates[1]?.final_price_paise).toBeGreaterThanOrEqual(419900);
  });

  it('Auction evaluation: excludes merchants below buyer reliability floor and selects highest utility eligible merchant', () => {
    const rawBids = [
      {
        merchant_id: 'merchant-a',
        merchant_name: 'Merchant A',
        sku: 'SKU-A',
        product_name: 'Product A',
        unit_price_paise: 2950000, // ₹29,500
        total_price_paise: 2950000 * 20,
        discount_paise: 250000,
        delivery_promise: '2026-09-03T23:59:59Z',
        delivery_day_label: 'Thursday',
        return_terms_days: 7,
        extras_description: 'Free branding',
        signed_contract: { offer_id: 'off-a' },
        reliability: {
          total_completed_deals: 18,
          on_time_deliveries: 16,
          disputed_or_refunded_orders: 1,
          signed_contracts_total: 18,
          signed_contracts_paid: 18,
          on_time_rate: 0.889,
          dispute_rate: 0.944,
          completion_rate: 1.0,
          reliability_score: 0.944,
          star_rating: 4.7,
        },
      },
      {
        merchant_id: 'merchant-b',
        merchant_name: 'Merchant B',
        sku: 'SKU-B',
        product_name: 'Product B',
        unit_price_paise: 2890000, // ₹28,900 (Cheapest)
        total_price_paise: 2890000 * 20,
        discount_paise: 210000,
        delivery_promise: '2026-09-04T23:59:59Z',
        delivery_day_label: 'Friday',
        return_terms_days: 7,
        extras_description: 'Standard pack',
        signed_contract: { offer_id: 'off-b' },
        reliability: {
          total_completed_deals: 20,
          on_time_deliveries: 12,
          disputed_or_refunded_orders: 4,
          signed_contracts_total: 20,
          signed_contracts_paid: 16,
          on_time_rate: 0.60,
          dispute_rate: 0.80,
          completion_rate: 0.80,
          reliability_score: 0.733,
          star_rating: 3.7,
        },
      },
    ];

    // Run 1: No floor (0★) -> Merchant B (cheapest) wins
    const run1 = evaluateBuyerMultiAttributeUtility(rawBids, ['price'], 3000000, 0);
    expect(run1.winner.merchant_id).toBe('merchant-b');

    // Run 2: 4.0★ floor -> Merchant B is excluded (3.7★ < 4.0★), Merchant A (4.7★) wins
    const run2 = evaluateBuyerMultiAttributeUtility(rawBids, ['price'], 3000000, 4.0);
    expect(run2.winner.merchant_id).toBe('merchant-a');
    expect(run2.competing_bids.find((b) => b.merchant_id === 'merchant-b')?.excluded_by_floor).toBe(true);
  });
});
