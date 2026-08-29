import { describe, it, expect } from 'vitest';
import {
  checkMinMargin,
  checkMaxDiscount,
  checkInventoryAvailability,
  checkDeliveryReachable,
  checkOfferNotExpired,
  checkPaymentAmountExact,
  checkHumanApprovalThreshold,
  checkFastMovingDiscountRestriction,
  checkClearanceEligibility,
  checkPrepaidIncentiveAllowed,
  evaluateAllPolicies,
  type CandidateOfferInput,
  type MerchantPolicyConfig,
  type ProductSnapshot,
  type InventorySnapshot,
} from '../index.js';

describe('Deterministic Policy Engine (GEMINI.md Part 4)', () => {
  const basePolicy: MerchantPolicyConfig = {
    policy_version: 'v1',
    min_margin_pct: 18.0,
    max_discount_pct: 12.0,
    free_delivery_above_paise: 149900,
    no_discount_fast_moving: true,
    clear_within_days: 30,
    prepaid_discount_on_high_cod_risk: true,
    human_approval_above_paise: 1500000, // ₹15,000
  };

  const baseProduct: ProductSnapshot = {
    sku: 'SPRINTPRO-X2',
    cost_paise: 265000, // ₹2,650
    list_price_paise: 429900, // ₹4,299
    movement_rate: 'slow',
    expiry_date: null,
    warehouse_location: 'BLR-WH-01',
    clearance_flag: false,
  };

  const baseInventory: InventorySnapshot = {
    sku: 'SPRINTPRO-X2',
    available_qty: 41,
    warehouse_location: 'BLR-WH-01',
    carrier_sla_days: { 'BLR-WH-01': 2 },
  };

  const fixedNow = new Date('2026-08-25T12:00:00.000Z');

  describe('1. Minimum Margin Rule (min_margin_pct = 18.0%)', () => {
    it('passes when proposed price lands at exactly 18.0% margin boundary', () => {
      // Cost = 265,000. 18% margin = 47,700. Min price = 312,700 paise.
      const boundaryOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 312700,
        discount_paise: 117200,
        delivery_promise: '2026-08-29T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkMinMargin(boundaryOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
      expect(result.checked_rule).toBe('RULE_MIN_MARGIN');
      expect(result.reason).toContain('18.00%');
    });

    it('fails a proposed price because margin lands at 17.9% instead of the required 18%', () => {
      // Cost = 265,000. Price = 312,435 paise -> Margin = 47,435 / 265,000 = 17.90%
      const belowMarginOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 312435,
        discount_paise: 117465,
        delivery_promise: '2026-08-29T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkMinMargin(belowMarginOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.checked_rule).toBe('RULE_MIN_MARGIN');
      expect(result.reason).toContain('17.90% margin');
      expect(result.reason).toContain('violates required minimum margin of 18.00%');
    });

    it('passes with higher profitable margin (e.g. SprintPro X2 Offer A at 49.0% / 20.4%)', () => {
      const offerA: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkMinMargin(offerA, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
    });
  });

  describe('2. Maximum Discount Ceiling Rule (max_discount_pct = 12.0%)', () => {
    it('passes when proposed discount is at exact 12.0% ceiling boundary', () => {
      // List = 429,900. 12% discount = floor(429,900 * 0.12) = 51,588 paise.
      const boundaryOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 378312,
        discount_paise: 51588,
        delivery_promise: '2026-08-29T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkMaxDiscount(boundaryOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
      expect(result.checked_rule).toBe('RULE_MAX_DISCOUNT');
    });

    it('fails a proposed 20% discount because it exceeds a 12% ceiling', () => {
      // List = 429,900. 20% discount = 85,980 paise > 51,588 paise ceiling.
      const excessiveDiscountOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 343920,
        discount_paise: 85980,
        delivery_promise: '2026-08-29T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkMaxDiscount(excessiveDiscountOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.checked_rule).toBe('RULE_MAX_DISCOUNT');
      expect(result.reason).toContain('exceeds the maximum allowable discount ceiling of 12.00%');
      expect(result.reason).toContain('85980 paise');
    });
  });

  describe('3. Inventory Availability Rule', () => {
    it('passes when requested quantity equals exact available inventory', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 41,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkInventoryAvailability(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
    });

    it('fails when requested quantity exceeds available inventory by 1 unit', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 42,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkInventoryAvailability(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('Insufficient inventory');
    });

    it('fails when available inventory is zero', () => {
      const emptyInventory: InventorySnapshot = {
        ...baseInventory,
        available_qty: 0,
      };

      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkInventoryAvailability(offer, basePolicy, baseProduct, emptyInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('Out of stock');
    });
  });

  describe('4. Offer Expiration Boundary (offer.expires_at > now)', () => {
    it('passes when offer expires 1 millisecond in future', () => {
      const futureOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: new Date(fixedNow.getTime() + 1000).toISOString(),
      };

      const result = checkOfferNotExpired(futureOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
    });

    it('fails at exact boundary t = 0 (expires_at == now)', () => {
      const boundaryOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: fixedNow.toISOString(),
      };

      const result = checkOfferNotExpired(boundaryOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('Offer expired');
    });

    it('fails when offer expiration is in the past', () => {
      const pastOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: new Date(fixedNow.getTime() - 5000).toISOString(),
      };

      const result = checkOfferNotExpired(pastOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
    });
  });

  describe('5. Payment Exactness (payment.amount == contract.final_price_paise)', () => {
    it('passes when payment amount matches order total exactly in integer paise', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 2,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
        payment_amount_paise: 789800, // 394900 * 2
      };

      const result = checkPaymentAmountExact(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
    });

    it('fails when payment amount differs by even 1 paise', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 2,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
        payment_amount_paise: 789801, // 1 paise mismatch
      };

      const result = checkPaymentAmountExact(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('Payment amount mismatch');
    });
  });

  describe('6. Human Approval Threshold Routing (Threshold = ₹15,000 = 1,500,000 paise)', () => {
    it('routes to POLICY_APPROVED when order total is at exact ₹15,000 boundary', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 1500000,
        discount_paise: 0,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkHumanApprovalThreshold(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);

      const evaluation = evaluateAllPolicies(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(evaluation.status).toBe('POLICY_APPROVED');
      expect(evaluation.requires_human_approval).toBe(false);
    });

    it('routes to APPROVAL_PENDING when order total exceeds ₹15,000 by 1 paise', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 1500001,
        discount_paise: 0,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkHumanApprovalThreshold(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('Routing to APPROVAL_PENDING');

      const evaluation = evaluateAllPolicies(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(evaluation.status).toBe('APPROVAL_PENDING');
      expect(evaluation.requires_human_approval).toBe(true);
      expect(evaluation.pass).toBe(true); // Valid rules, but pending human approval
    });
  });

  describe('7. Fast-Moving Discount Restriction & Clearance Overrides', () => {
    const fastProduct: ProductSnapshot = {
      ...baseProduct,
      movement_rate: 'fast',
      clearance_flag: false,
    };

    it('fails discounting on fast-moving SKU without clearance flag', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkFastMovingDiscountRestriction(offer, basePolicy, fastProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('prohibited by merchant policy');
    });

    it('passes fast-moving discount when clearance_flag is enabled', () => {
      const clearanceProduct: ProductSnapshot = {
        ...fastProduct,
        clearance_flag: true,
      };

      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkFastMovingDiscountRestriction(offer, basePolicy, clearanceProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
      expect(result.reason).toContain('clearance exemption');
    });

    it('passes fast-moving discount when product expires within 30 days', () => {
      const expiringProduct: ProductSnapshot = {
        ...fastProduct,
        expiry_date: new Date(fixedNow.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days away
      };

      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
      };

      const result = checkFastMovingDiscountRestriction(offer, basePolicy, expiringProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
      expect(result.reason).toContain('clearance exemption');
    });
  });

  describe('8. High COD Risk Prepaid Incentive', () => {
    it('allows prepaid incentive subsidy when COD risk is high and payment is prepaid (UPI/Card)', () => {
      const offer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        delivery_promise: '2026-08-31T23:59:59Z',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T13:00:00Z',
        cod_return_risk: 'high',
      };

      const result = checkPrepaidIncentiveAllowed(offer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(result.pass).toBe(true);
      expect(result.reason).toContain('Prepaid incentive discount allowed');
    });
  });

  describe('9. Composite Policy Evaluation', () => {
    it('evaluates SprintPro X2 Offer A and returns POLICY_APPROVED', () => {
      const sprintProOfferA: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900, // ₹3,949
        discount_paise: 35000, // ₹350 (8.14% discount <= 12% max discount)
        delivery_promise: '2026-08-31T23:59:59Z', // Monday
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: new Date(fixedNow.getTime() + 8 * 60 * 1000).toISOString(), // 8-minute expiry
      };

      const evaluation = evaluateAllPolicies(sprintProOfferA, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(evaluation.pass).toBe(true);
      expect(evaluation.status).toBe('POLICY_APPROVED');
      expect(evaluation.rejection_reasons).toHaveLength(0);
    });

    it('rejects candidate offer when any hard constraint is violated', () => {
      const failingOffer: CandidateOfferInput = {
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 200000, // Below cost of 265000
        discount_paise: 229900, // Exceeds 12% max discount
        delivery_promise: '2026-08-20T23:59:59Z', // Past delivery date
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T11:00:00Z', // Expired
      };

      const evaluation = evaluateAllPolicies(failingOffer, basePolicy, baseProduct, baseInventory, fixedNow);
      expect(evaluation.pass).toBe(false);
      expect(evaluation.status).toBe('POLICY_REJECTED');
      expect(evaluation.rejection_reasons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
