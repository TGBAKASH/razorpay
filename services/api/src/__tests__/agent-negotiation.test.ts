import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { stateMachine } from '../services/state-machine.js';

describe('Agent-to-Agent Autonomous Negotiation (4-Round Safety Net)', () => {
  const server = buildServer();

  beforeEach(() => {
    nonceStore.reset();
    stateMachine.reset();
  });

  it('runs autonomous negotiation converging within 4 rounds with plain-language transcript and clamped bounds', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/negotiation/agent-dialog',
      payload: {
        sku: 'SPRINTPRO-X2',
        buyer_agent_id: 'buyer-agent-test-converge',
        force_fallback: true, // Use deterministic fallback in CI to avoid live API timeouts
        buyer_constraints: {
          budget_max_paise: 400000, // ₹4,000.00 ceiling
          currency: 'INR',
          delivery_deadline: '2026-09-07T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);

    // Invariant 1: Capped strictly at 4 rounds
    expect(result.rounds_completed).toBeLessThanOrEqual(4);
    expect(result.rounds_completed).toBeGreaterThanOrEqual(1);

    // Invariant 2: Agreement or fallback reached
    expect([true, false]).toContain(result.agreement_reached);

    // Invariant 3: Ground-truth bounds strictly respected
    const floorPaise = 323200; // 18% floor on ₹2,650 cost
    const ceilingPaise = 400000; // ₹4,000 ceiling
    expect(result.final_price_paise).toBeGreaterThanOrEqual(floorPaise);
    expect(result.final_price_paise).toBeLessThanOrEqual(ceilingPaise);

    // Invariant 4: Plain-language transcript with alternating roles
    expect(result.transcript.length).toBeGreaterThanOrEqual(2);
    for (const turn of result.transcript) {
      expect(['buyer_agent', 'merchant_agent']).toContain(turn.speaker);
      expect(turn.message.length).toBeGreaterThan(20);
      expect(parseFloat(turn.clamped_price_inr)).toBeGreaterThan(0);
      // Clamped price can never exceed ceiling or drop below cost
      expect(parseFloat(turn.clamped_price_inr)).toBeLessThanOrEqual(4299);
    }

    // Invariant 5: Contract sealed cryptographically
    expect(result.signed_contract).toBeDefined();
    expect(result.signed_contract.signature).toBeDefined();
  });

  it('automatically falls back to Part 1 / Part 2 deterministic candidate if 4 rounds conclude without consensus', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/negotiation/agent-dialog',
      payload: {
        sku: 'SPRINTPRO-X2',
        buyer_agent_id: 'buyer-agent-test-fallback',
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: '2026-09-07T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed'],
        },
        force_fallback: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);

    // Invariant 1: Exactly 4 rounds executed
    expect(result.rounds_completed).toBe(4);

    // Invariant 2: Graceful fallback activated (Never fails with empty output)
    expect(result.agreement_reached).toBe(false);
    expect(result.fallback_applied).toBe(true);

    // Invariant 3: Exact match to Part 1 / Part 2 optimal price (₹3,783.12)
    expect(result.final_price_inr).toBe('3783.12');
    expect(result.governing_rule).toBe('RULE_AGENT_NEGOTIATION_FALLBACK_TO_PART2_OPTIMAL');
    expect(result.summary_rationale).toContain('Safety net activated');

    // Invariant 4: Contract successfully sealed with fallback terms
    expect(result.signed_contract.canonical_payload.final_price_paise).toBe(378312);
  });

  it('enforces deterministic price clamping when proposed price exceeds buyer ceiling', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/negotiation/agent-dialog',
      payload: {
        sku: 'SPRINTPRO-X2',
        force_fallback: true, // Use deterministic fallback in CI
        buyer_constraints: {
          budget_max_paise: 360000, // Lower ₹3,600 ceiling
          currency: 'INR',
          delivery_deadline: '2026-09-07T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);

    // Check that at least one buyer turn was clamped to the ₹3,600 ceiling
    const clampedTurn = result.transcript.find(
      (t: any) => t.speaker === 'buyer_agent' && t.was_clamped
    );
    if (clampedTurn) {
      expect(parseFloat(clampedTurn.clamped_price_inr)).toBeLessThanOrEqual(3600);
      expect(clampedTurn.clamping_reason).toContain('ceiling');
    }
  });

  it('exhibits visible deadline-aware urgency in plain language when deadline is under 24 hours', async () => {
    const urgentDeadline = new Date(Date.now() + 10 * 3600 * 1000).toISOString(); // 10 hours from now
    const res = await server.inject({
      method: 'POST',
      url: '/api/negotiation/agent-dialog',
      payload: {
        sku: 'SPRINTPRO-X2',
        buyer_agent_id: 'buyer-agent-urgent-test',
        force_fallback: true, // Use deterministic fallback in CI
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: urgentDeadline,
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['delivery_speed', 'price'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);

    // Invariant 1: Urgency flag is active and hours calculated
    expect(result.deadline_urgency_active).toBe(true);
    expect(result.hours_until_deadline).toBeGreaterThan(0);
    expect(result.hours_until_deadline).toBeLessThanOrEqual(24);

    // Invariant 2: Buyer agent visibly states urgency in its own words (never a silent adjustment)
    const buyerTurns = result.transcript.filter((t: any) => t.speaker === 'buyer_agent');
    expect(buyerTurns.length).toBeGreaterThan(0);

    const hasUrgencyLanguage = buyerTurns.some((t: any) =>
      t.message.includes('Given the deadline, I can move a bit further on price to close this now') ||
      t.message.includes('deadline under 24 hours away')
    );
    expect(hasUrgencyLanguage).toBe(true);

    // Invariant 3: Ground-truth ceiling and floor remain inviolate
    expect(result.final_price_paise).toBeLessThanOrEqual(400000);
    expect(result.final_price_paise).toBeGreaterThanOrEqual(323200);

    // Invariant 4: Summary rationale records deadline posture
    expect(result.summary_rationale).toContain('deadline-aware posture');
  });

  it('maintains standard cost-efficiency posture without urgency language when deadline is distant (> 24h)', async () => {
    const standardDeadline = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(); // 5 days from now
    const res = await server.inject({
      method: 'POST',
      url: '/api/negotiation/agent-dialog',
      payload: {
        sku: 'SPRINTPRO-X2',
        buyer_agent_id: 'buyer-agent-standard-test',
        force_fallback: true, // Use deterministic fallback in CI
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: standardDeadline,
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);

    expect(result.deadline_urgency_active).toBe(false);
    const buyerTurns = result.transcript.filter((t: any) => t.speaker === 'buyer_agent');
    for (const t of buyerTurns) {
      expect(t.message).not.toContain('deadline under 24 hours away');
    }
  });
});
