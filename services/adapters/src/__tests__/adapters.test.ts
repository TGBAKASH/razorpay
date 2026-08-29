import { describe, it, expect } from 'vitest';
import { adaptAcpToCCO, sampleAcpSprintProPayload } from '../acp.js';
import { adaptUcpToCCO, sampleUcpPayload } from '../ucp.js';
import { adaptAp2ToCCO, sampleAp2Payload } from '../ap2.js';
import { adaptMockUapToCCO, sampleMockUapPayload } from '../mock-uap.js';
import { CommonCommerceObjectSchema } from '../common-commerce-object.js';

describe('Protocol Adapters (services/adapters) - ACP, UCP, AP2, MockUAP', () => {
  it('ACP Adapter: maps ACP payload into valid CCO with all required fields round-tripped', () => {
    const cco = adaptAcpToCCO(sampleAcpSprintProPayload);

    // Schema validation
    const parsed = CommonCommerceObjectSchema.safeParse(cco);
    expect(parsed.success).toBe(true);

    // Required fields verification
    expect(cco.intent.protocol_source).toBe('ACP');
    expect(cco.intent.category).toBe('running shoes');
    expect(cco.intent.buyer_agent_id).toBe('acp-agent-runner-01');
    expect(cco.buyer_constraints.budget_max_paise).toBe(400000); // ₹4,000
    expect(cco.buyer_constraints.delivery_deadline).toBe('2026-09-01T23:59:59Z');
    expect(cco.buyer_constraints.quantity).toBe(1);
    expect(cco.buyer_constraints.payment_preference).toEqual(['upi', 'card']);
    expect(cco.buyer_constraints.priorities).toEqual(['price', 'delivery_speed', 'return_terms', 'extras']);
  });

  it('UCP Adapter: maps UCP payload into valid CCO with all required fields round-tripped', () => {
    const cco = adaptUcpToCCO(sampleUcpPayload);

    const parsed = CommonCommerceObjectSchema.safeParse(cco);
    expect(parsed.success).toBe(true);

    expect(cco.intent.protocol_source).toBe('UCP');
    expect(cco.intent.buyer_agent_id).toBe('did:ucp:agent:bangalore_runner_42');
    expect(cco.buyer_constraints.budget_max_paise).toBe(400000);
    expect(cco.buyer_constraints.delivery_deadline).toBe('2026-09-01T23:59:59Z');
    expect(cco.buyer_constraints.quantity).toBe(1);
    expect(cco.buyer_constraints.payment_preference).toEqual(['upi']);
    expect(cco.buyer_constraints.priorities).toEqual(['price', 'delivery_speed', 'return_terms', 'extras']);
  });

  it('AP2 Adapter: maps AP2 payload into valid CCO with mandate authorization preserved', () => {
    const cco = adaptAp2ToCCO(sampleAp2Payload);

    const parsed = CommonCommerceObjectSchema.safeParse(cco);
    expect(parsed.success).toBe(true);

    expect(cco.intent.protocol_source).toBe('AP2');
    expect(cco.intent.buyer_agent_id).toBe('ap2-buyer-enterprise-01');
    expect(cco.buyer_constraints.budget_max_paise).toBe(400000);
    expect(cco.buyer_constraints.delivery_deadline).toBe('2026-09-01T23:59:59Z');
    expect(cco.buyer_constraints.quantity).toBe(1);
    expect(cco.buyer_constraints.payment_preference).toEqual(['upi', 'card']);
    expect(cco.authorization?.signature).toBe('ap2_sig_hmac256_mock_0192837465');
    expect(cco.authorization?.nonce).toBe('mandate_ap2_corp_441');
  });

  it('Mock-UAP Adapter: maps Mock-UAP payload into valid CCO', () => {
    const cco = adaptMockUapToCCO(sampleMockUapPayload);

    const parsed = CommonCommerceObjectSchema.safeParse(cco);
    expect(parsed.success).toBe(true);

    expect(cco.intent.protocol_source).toBe('mock-UAP');
    expect(cco.intent.buyer_agent_id).toBe('agent://uap.mesh/runner-42');
    expect(cco.buyer_constraints.budget_max_paise).toBe(400000);
    expect(cco.buyer_constraints.quantity).toBe(1);
    expect(cco.buyer_constraints.payment_preference).toEqual(['upi']);
  });
});
