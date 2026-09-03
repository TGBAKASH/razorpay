import { describe, it, expect } from 'vitest';
import { buildServer } from '../index.js';
import {
  CommonCommerceObjectSchema,
  BuyerConstraintsSectionSchema,
} from '@razorpay-dealflow/adapters';

describe('Intent Parsing & CCO Ingestion API', () => {
  const server = buildServer();

  it('parses free-text example from the brief into validated structured constraints', async () => {
    const rawQuery = 'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI';
    const referenceDate = '2026-08-25T12:00:00.000Z'; // Tuesday

    const parseResponse = await server.inject({
      method: 'POST',
      url: '/api/intent/parse',
      payload: {
        query: rawQuery,
        reference_date: referenceDate,
      },
    });

    expect(parseResponse.statusCode).toBe(200);
    const parsedBody = JSON.parse(parseResponse.body);
    expect(parsedBody.success).toBe(true);
    expect(parsedBody.is_complete).toBe(true);
    expect(parsedBody.missing_fields).toHaveLength(0);

    // Verify category and constraints
    expect(parsedBody.category).toBe('running shoes');
    expect(parsedBody.buyer_constraints.budget_max_paise).toBe(400000); // ₹4,000 in integer paise
    expect(parsedBody.buyer_constraints.currency).toBe('INR');
    expect(parsedBody.buyer_constraints.quantity).toBe(1);
    expect(parsedBody.buyer_constraints.payment_preference).toEqual(['upi']);
    expect(parsedBody.buyer_constraints.return_preference).toBe('easy returns');
    expect(parsedBody.buyer_constraints.priorities).toContain('price');
    expect(parsedBody.buyer_constraints.priorities).toContain('delivery_speed');

    // Re-validate parsed constraints against Zod schema
    const zodValidation = BuyerConstraintsSectionSchema.safeParse(parsedBody.buyer_constraints);
    expect(zodValidation.success).toBe(true);
  });

  it('detects missing required fields on incomplete queries', async () => {
    const incompleteQuery = 'just want running shoes';

    const parseResponse = await server.inject({
      method: 'POST',
      url: '/api/intent/parse',
      payload: { query: incompleteQuery },
    });

    expect(parseResponse.statusCode).toBe(200);
    const parsedBody = JSON.parse(parseResponse.body);
    expect(parsedBody.is_complete).toBe(false);
    expect(parsedBody.missing_fields).toContain('budget_max_paise');
    expect(parsedBody.missing_fields).toContain('delivery_deadline');
    expect(parsedBody.missing_fields).toContain('payment_preference');
  }, 15000);

  it('ingests structured intent submission and produces a complete Common Commerce Object', async () => {
    const submission = {
      buyer_agent_id: 'buyer-agent-sim-01',
      protocol_source: 'simulator',
      category: 'running shoes',
      raw_query: 'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI',
      buyer_constraints: {
        budget_max_paise: 400000,
        currency: 'INR',
        delivery_deadline: '2026-09-01T23:59:59.000Z',
        quantity: 1,
        payment_preference: ['upi'],
        return_preference: 'easy returns',
        priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
      },
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/intent',
      payload: submission,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.intent_id).toBeDefined();

    // Verify constructed CCO conforms to Common Commerce Object schema
    const validation = CommonCommerceObjectSchema.safeParse(body.cco);
    expect(validation.success).toBe(true);
    expect(body.cco.intent.category).toBe('running shoes');
    expect(body.cco.intent.protocol_source).toBe('simulator');
    expect(body.cco.fulfillment.state).toBe('REQUEST_RECEIVED');
  });

  it('parses mixed Hindi/English (Hinglish) query correctly with budget, category, and priorities', async () => {
    const hinglishQuery = 'yaar mujhe wo shoes chahiye jo saste mein mile, teen hazar se zyada nahi, jaldi chahiye';

    const parseResponse = await server.inject({
      method: 'POST',
      url: '/api/intent/parse',
      payload: { query: hinglishQuery },
    });

    expect(parseResponse.statusCode).toBe(200);
    const parsedBody = JSON.parse(parseResponse.body);
    expect(parsedBody.success).toBe(true);
    expect(parsedBody.category).toContain('shoes');
    expect(parsedBody.buyer_constraints.budget_max_paise).toBe(300000); // teen hazar = ₹3,000 = 300,000 paise
    expect(parsedBody.buyer_constraints.priorities).toContain('price'); // saste mein
    expect(parsedBody.buyer_constraints.priorities).toContain('delivery_speed'); // jaldi chahiye
  }, 15000);

  it('parses natural language merchant policy rules into structured guardrails', async () => {
    const policyPrompt = "don't discount more than 12%, keep at least 18% margin, get my approval above ₹15,000, free delivery above ₹1,499";

    const response = await server.inject({
      method: 'POST',
      url: '/api/policy/interpret-nl',
      payload: { prompt: policyPrompt },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.policy.minMarginPct).toBe(18);
    expect(body.policy.maxDiscountPct).toBe(12);
    expect(body.policy.humanApprovalAbovePaise).toBe(1500000);
    expect(body.policy.freeDeliveryAbovePaise).toBe(149900);
  });
});
