import { describe, it, expect } from 'vitest';
import {
  CommonCommerceObjectSchema,
  BuyerConstraintsSectionSchema,
  BuyerIntentSubmissionSchema,
  type CommonCommerceObject,
} from '../common-commerce-object.js';

describe('Common Commerce Object Schema', () => {
  it('validates complete Common Commerce Object correctly', () => {
    const validCCO: CommonCommerceObject = {
      intent: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        buyer_agent_id: 'buyer_007',
        protocol_source: 'simulator',
        category: 'running shoes',
        raw_query: 'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI',
        created_at: new Date().toISOString(),
      },
      buyer_constraints: {
        budget_max_paise: 400000,
        currency: 'INR',
        delivery_deadline: '2026-09-01T23:59:59Z',
        quantity: 1,
        payment_preference: ['upi'],
        return_preference: 'easy returns',
        priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
      },
      cart: {
        items: [
          {
            sku: 'SPRINTPRO-X2',
            qty: 1,
            list_price_paise: 429900,
          },
        ],
      },
      offer: {
        offer_id: 'offer-12345',
        sku: 'SPRINTPRO-X2',
        quantity: 1,
        final_price_paise: 394900,
        discount_paise: 35000,
        discount_reason: ['Slow moving item', 'Prepaid incentive'],
        delivery_promise: '2026-08-31',
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: '2026-08-25T21:00:00Z',
        policy_version: 'v1',
      },
      authorization: {
        signature: 'mock_sig_123',
        signing_key_id: 'key_v1',
        nonce: 'nonce_123',
        signed_at: '2026-08-25T20:50:00Z',
      },
      payment: {
        razorpay_order_id: 'order_123',
        razorpay_payment_id: null,
        status: 'PENDING',
        amount_paise: 394900,
        method: 'upi',
      },
      fulfillment: {
        state: 'OFFER_ACCEPTED',
        events: [
          {
            at: '2026-08-25T20:51:00Z',
            event: 'offer_accepted',
            detail: { accepted_by: 'buyer_007' },
          },
        ],
      },
    };

    const parsed = CommonCommerceObjectSchema.safeParse(validCCO);
    expect(parsed.success).toBe(true);
  });

  it('rejects buyer constraints with non-integer paise or empty payment preference', () => {
    const invalidConstraints = {
      budget_max_paise: 4000.5, // float is prohibited
      currency: 'INR',
      delivery_deadline: '2026-09-01',
      quantity: 1,
      payment_preference: [], // at least 1 required
      return_preference: 'easy returns',
      priorities: ['price'],
    };

    const parsed = BuyerConstraintsSectionSchema.safeParse(invalidConstraints);
    expect(parsed.success).toBe(false);
  });

  it('validates BuyerIntentSubmission schema properly', () => {
    const submission = {
      buyer_agent_id: 'buyer-agent-sim-01',
      category: 'running shoes',
      raw_query: 'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI',
      buyer_constraints: {
        budget_max_paise: 400000,
        currency: 'INR' as const,
        delivery_deadline: '2026-09-01T00:00:00.000Z',
        quantity: 1,
        payment_preference: ['upi' as const],
        return_preference: 'easy returns',
        priorities: ['price' as const, 'delivery_speed' as const, 'return_terms' as const, 'extras' as const],
      },
    };

    const parsed = BuyerIntentSubmissionSchema.safeParse(submission);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.protocol_source).toBe('simulator');
      expect(parsed.data.buyer_constraints.budget_max_paise).toBe(400000);
    }
  });
});
