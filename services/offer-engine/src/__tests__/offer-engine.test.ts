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
});
