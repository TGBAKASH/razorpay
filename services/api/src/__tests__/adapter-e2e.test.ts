import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import {
  adaptAcpToCCO,
  adaptAp2ToCCO,
  sampleAcpSprintProPayload,
  sampleAp2Payload,
} from '@razorpay-dealflow/adapters';
import { stateMachine } from '../services/state-machine.js';
import { nonceStore, verify } from '@razorpay-dealflow/contract-service';

describe('Protocol Adapters End-to-End Verification (Phase 10)', () => {
  const server = buildServer();

  beforeEach(() => {
    stateMachine.reset();
    nonceStore.reset();
  });

  it('feeds mock ACP payload through ACP adapter and generates valid signed OfferContract via standard offer engine pipeline', async () => {
    // 1. Map raw ACP payload into CCO using ACP adapter
    const ccoFromAcp = adaptAcpToCCO(sampleAcpSprintProPayload);
    expect(ccoFromAcp.intent.protocol_source).toBe('ACP');

    // 2. Ingest mapped CCO through POST /api/offers/generate (exact same code path as simulator)
    const res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: { cco: ccoFromAcp },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // 3. Verify output OfferContract
    const offer = body.cco.offer;
    const contract = body.signed_contract;

    expect(offer.sku).toBe('SPRINTPRO-X2');
    expect(offer.final_price_paise).toBe(394900); // ₹3,949
    expect(offer.discount_paise).toBe(35000); // ₹350 discount
    expect(contract.canonical_payload.buyer_agent_id).toBe('acp-agent-runner-01');

    // 4. Verify cryptographic HMAC signature on output contract
    const verification = verify(contract);
    expect(verification.valid).toBe(true);

    // 5. Verify audit trail reflects ACP origin
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${contract.offer_id}`,
    });
    const logs = JSON.parse(auditRes.body).logs;
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0].actor).toContain('acp-agent-runner-01');
  });

  it('feeds mock AP2 payload through AP2 adapter and generates valid signed OfferContract via standard offer engine pipeline', async () => {
    // 1. Map raw AP2 payload into CCO using AP2 adapter
    const ccoFromAp2 = adaptAp2ToCCO(sampleAp2Payload);
    expect(ccoFromAp2.intent.protocol_source).toBe('AP2');

    // 2. Ingest mapped CCO through POST /api/offers/generate
    const res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: { cco: ccoFromAp2 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // 3. Verify output OfferContract
    const offer = body.cco.offer;
    const contract = body.signed_contract;

    expect(offer.sku).toBe('SPRINTPRO-X2');
    expect(offer.final_price_paise).toBe(394900);
    expect(contract.canonical_payload.buyer_agent_id).toBe('ap2-buyer-enterprise-01');

    // 4. Verify cryptographic signature
    const verification = verify(contract);
    expect(verification.valid).toBe(true);
  });

  it('verifies POST /api/intent/adapt endpoint dynamically normalizes any supported protocol', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/intent/adapt',
      payload: {
        protocol: 'ACP',
        raw_payload: sampleAcpSprintProPayload,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.cco.intent.protocol_source).toBe('ACP');
    expect(body.cco.buyer_constraints.budget_max_paise).toBe(400000);
  });
});
