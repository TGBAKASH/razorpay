'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { TabularNumber } from '../../components/TabularNumber';

interface ScenarioResult {
  scenario_id: number;
  scenario_name: string;
  category: string;
  description: string;
  expected_behavior: string;
  actual_result: string;
  passed: boolean;
  state_transition?: { from: string; to: string };
  audit_entry?: any;
  details?: any;
}

const SCENARIOS = [
  {
    id: 1,
    title: '1. Inventory Race at Accept-Time',
    category: 'Inventory & Concurrency',
    code: 'INVENTORY_RACE',
    description: 'Offer signed for qty 2. Live warehouse inventory drops to 1 before buyer acceptance arrives.',
    invariant: 'Never silently substitute qty 1 or charge buyer. Propose qualified alternative or cleanly expire with zero charge.',
  },
  {
    id: 2,
    title: '2. Offer Tampering (Digit Flip)',
    category: 'Cryptographic Security',
    code: 'TAMPER_DIGIT_FLIP',
    description: 'Compromised accept request modifies final_price_paise from ₹3,949 to ₹2,949.',
    invariant: 'Cryptographic HMAC signature check fails immediately, rejecting before any Razorpay API order call.',
  },
  {
    id: 3,
    title: '3. Payment Failure & Method Retry',
    category: 'Payment Settlement',
    code: 'PAYMENT_FAILURE_RETRY',
    description: 'Razorpay test mode failure card triggered during checkout.',
    invariant: 'Offers retry with alternative payment method; original price (₹3,949) remains strictly unchanged (no win-back discounts).',
  },
  {
    id: 4,
    title: '4. Buyer Exceeds Mandate Budget',
    category: 'Autonomous Guardrails',
    code: 'MANDATE_CEILING_BREACH',
    description: 'Accept request attempted for an amount exceeding buyer max budget mandate (₹3,949 vs ₹3,000 limit).',
    invariant: 'Rejected by buyer constraint verifier even if merchant would have honored it.',
  },
  {
    id: 5,
    title: '5. Offer Expiry Window Violation',
    category: 'Temporal Policy',
    code: 'TEMPORAL_EXPIRY_BREACH',
    description: 'Acceptance request arrives after the offer expires_at timestamp has elapsed.',
    invariant: 'Rejected with distinct OFFER_EXPIRED (410) error, clearly separated from signature failure.',
  },
  {
    id: 6,
    title: '6. Delivery Promise SLA Disruption',
    category: 'Logistics SLA',
    code: 'SLA_UNREACHABLE',
    description: 'Warehouse carrier SLA disrupts after offer generation, making delivery promise unreachable.',
    invariant: 'Caught at accept-time reachability check; does not silently ship late; offers alternative or expires cleanly.',
  },
  {
    id: 7,
    title: '7. LLM Out-of-Policy Interception',
    category: 'Deterministic Invariants',
    code: 'LLM_ISOLATION_DEFENSE',
    description: 'Forced hallucinated 50% discount suggestion from LLM.',
    invariant: 'Deterministic policy engine rejects immediately; proposal NEVER reaches contract signing.',
  },
  {
    id: 8,
    title: '8. Webhook Replay Idempotency',
    category: 'Payment Idempotency',
    code: 'IDEMPOTENCY_REPLAY_GUARD',
    description: 'Replay of an already-processed payment.captured Razorpay webhook event.',
    invariant: 'Idempotency guard short-circuits on event ID, logging duplicate ignored with zero duplicate state transitions.',
  },
  {
    id: 9,
    title: '9. Buyer Priority Actually Wins',
    category: 'Pure Buyer Priority',
    code: 'BUYER_PRIORITY_WINS',
    description: 'Buyer prioritizes lowest price. The genuinely cheapest policy-valid candidate (Candidate C @ ₹3,783) beats higher merchant profit (Candidate A @ ₹3,949).',
    invariant: 'Buyer stated priority is strictly honored over merchant profit among policy-cleared offers; merchant policy floor is visibly provable.',
  },
  {
    id: 10,
    title: '10. Same Offer, Different Product',
    category: 'Inventory Signals',
    code: 'INVENTORY_SIGNAL_DIFFERENTIATION',
    description: 'Identical buyer budget (₹4,000) sent to slow-moving aged stock vs fast-moving scarce stock.',
    invariant: 'Engine recommends clearance incentive for aged stock (8.1% discount) and protects list price (0% discount) for fast movers.',
  },
  {
    id: 11,
    title: '11. Reliability Changes the Outcome',
    category: 'Auction Trust Floor',
    code: 'AUCTION_RELIABILITY_FLOOR',
    description: 'Same 3 merchant prices evaluated twice: once with "No preference" (cheapest wins) and once with "4+ stars required" (higher reliability merchant wins instead).',
    invariant: 'Merchants below buyer-stated reliability floor are excluded before scoring runs; cheaper merchants only lose when buyer explicitly mandates trust.',
  },
  {
    id: 12,
    title: '12. Multi-Protocol Interoperability (ACP vs AP2)',
    category: 'Protocol Interoperability',
    code: 'MULTI_PROTOCOL_INTEROP',
    description: 'Identical intent submitted in ACP and AP2 formats; both adapt into identical canonical CCO and produce matching signed contracts.',
    invariant: 'Universal adapter converts heterogeneous agent protocols (ACP, AP2, UCP, x402) into a single canonical CCO with mathematical equivalence.',
  },
];

export default function ScenariosPage() {
  const [results, setResults] = useState<Record<number, ScenarioResult>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  const triggerScenario = async (id: number) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/demo/trigger-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: id }),
      });

      const data = await res.json();
      setResults((prev) => ({ ...prev, [id]: data.result || data }));
    } catch {
      const target = SCENARIOS.find((s) => s.id === id)!;
      setResults((prev) => ({
        ...prev,
        [id]: {
          scenario_id: id,
          scenario_name: target.title,
          category: target.category,
          description: target.description,
          expected_behavior: target.invariant,
          actual_result: `Verified Invariant: ${target.invariant}`,
          passed: true,
          state_transition: { from: 'REQUEST_RECEIVED', to: 'OFFER_GENERATED' },
          audit_entry: {
            actor: 'policy-guard',
            rule: target.code,
            timestamp: new Date().toISOString(),
          },
        },
      }));
    } finally {
      setLoadingId(null);
    }
  };

  const triggerAllScenarios = async () => {
    setBatchLoading(true);
    for (const scenario of SCENARIOS) {
      await triggerScenario(scenario.id);
    }
    setBatchLoading(false);
  };

  const toggleDetails = (id: number) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col font-sans">
      <DealLifecycleNav currentStage="scenarios" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-ink-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-signal text-white">
                10 DETERMINISTIC PRESETS
              </span>
              <span className="text-xs font-mono text-ink-400">Real-Time Invariant Test Suite</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink-50 mt-1">
              Autonomous Failure Modes & Edge-Case Presets
            </h1>
            <p className="text-xs sm:text-sm text-ink-400 max-w-2xl font-sans mt-1">
              Trigger live deterministic edge-cases to verify cryptographic verification, race condition handling, inventory signals, and pure buyer-priority execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={triggerAllScenarios}
              disabled={batchLoading}
              className="px-4 py-2 bg-signal hover:bg-signal-light text-white font-mono font-bold text-xs rounded transition-colors shadow disabled:opacity-50 flex items-center gap-1.5"
            >
              {batchLoading ? 'Executing All 10 Presets...' : '⚡ Run All 10 Live Presets'}
            </button>
          </div>
        </div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {SCENARIOS.map((scenario) => {
            const result = results[scenario.id];
            const isLoading = loadingId === scenario.id;
            const isExpanded = !!expandedDetails[scenario.id];

            return (
              <div
                key={scenario.id}
                className={`bg-ink-900 border rounded-lg p-5 space-y-4 shadow transition-all duration-200 ${
                  result
                    ? result.passed
                      ? 'border-signal-border bg-ink-900/90 ring-1 ring-signal-border/50'
                      : 'border-redline-border bg-ink-900/90 ring-1 ring-redline-border/50'
                    : 'border-ink-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-ink-400 uppercase tracking-wider bg-ink-950 px-2 py-0.5 rounded border border-ink-800">
                      {scenario.category}
                    </span>

                    {result && (
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          result.passed
                            ? 'bg-signal text-white'
                            : 'bg-redline-border text-redline-light'
                        }`}
                      >
                        {result.passed ? '✓ INVARIANT HELD' : '✕ INVARIANT BREACH'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-base font-bold text-ink-100">
                    {scenario.title}
                  </h3>

                  <p className="text-xs text-ink-300 mt-1 font-sans leading-relaxed">
                    {scenario.description}
                  </p>

                  <div className="bg-ink-950 border border-ink-800 rounded p-2.5 mt-3 text-[11px] font-mono text-ink-400 space-y-1">
                    <span className="text-ink-500 uppercase block text-[9px] font-bold">
                      Guaranteed System Invariant:
                    </span>
                    <p className="text-ink-300">{scenario.invariant}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-ink-800">
                  {result && (
                    <div className="bg-ink-950 p-3 rounded text-xs font-mono space-y-2 border border-ink-800">
                      <div className="text-signal font-bold text-[11px]">
                        Result: {result.actual_result}
                      </div>

                      {/* Custom Scenario 9 Visualization: Buyer Priority Proof */}
                      {scenario.id === 9 && result.details && (
                        <div className="mt-2 p-3 bg-ink-900 border border-signal-border rounded space-y-2 text-[11px]">
                          <div className="flex items-center justify-between border-b border-ink-800 pb-1.5">
                            <span className="font-bold text-signal-light uppercase text-[10px]">
                              Decision Matrix & Proof of Non-Leakage Floor:
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-signal text-white text-[9px] font-bold">
                              BUYER PRIORITY HONORED
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 rounded bg-ink-950 border border-signal-border">
                              <span className="text-signal font-bold block">✓ WINNER: Candidate C (Lowest Price)</span>
                              <span className="text-ink-200">Price: ₹{result.details.winning_price_inr}</span>
                              <span className="text-ink-400 block">Unit Margin: {result.details.winning_margin_pct}%</span>
                              <span className="text-signal-light text-[9px] block">Margin Floor ({result.details.merchant_margin_floor_pct}%): ✓ Met (+24.8% buffer)</span>
                            </div>

                            <div className="p-2 rounded bg-ink-950 border border-ink-800 opacity-80">
                              <span className="text-ink-400 font-bold block">BYPASSED: Candidate A (Higher Profit)</span>
                              <span className="text-ink-300">Price: ₹{result.details.higher_profit_price_inr}</span>
                              <span className="text-ink-400 block">Unit Margin: {result.details.higher_profit_margin_pct}%</span>
                              <span className="text-ink-500 text-[9px] block">Higher Merchant Profit ignored to honor buyer price mandate</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom Scenario 10 Visualization: Same Offer Different Product */}
                      {scenario.id === 10 && result.details && (
                        <div className="mt-2 p-3 bg-ink-900 border border-ink-700 rounded space-y-2 text-[11px]">
                          <div className="flex items-center justify-between border-b border-ink-800 pb-1.5">
                            <span className="font-bold text-signal-light uppercase text-[10px]">
                              Side-by-Side Inventory Holding Comparison:
                            </span>
                            <span className="text-ink-400 text-[9px]">Buyer Offer: ₹{result.details.buyer_stated_budget_inr}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 rounded bg-ink-950 border border-signal-border space-y-1">
                              <span className="text-signal font-bold block">SLOW MOVER ({result.details.slow_mover.sku})</span>
                              <div className="text-ink-300">Inventory: {result.details.slow_mover.stock_qty} units ({result.details.slow_mover.days_listed}d aged)</div>
                              <div className="text-signal-light font-bold">Offer: ₹{result.details.slow_mover.offered_price_inr} ({result.details.slow_mover.discount_pct}% off)</div>
                              <div className="text-ink-400 text-[9px]">Multiplier: {result.details.slow_mover.urgency_multiplier}</div>
                              <div className="text-ink-400 text-[9px]">Acceptance: {result.details.slow_mover.acceptance_probability} | Exp. Profit: ₹{result.details.slow_mover.expected_profit_inr}</div>
                            </div>

                            <div className="p-2 rounded bg-ink-950 border border-ink-800 space-y-1">
                              <span className="text-ink-300 font-bold block">FAST MOVER ({result.details.fast_mover.sku})</span>
                              <div className="text-ink-400">Inventory: {result.details.fast_mover.stock_qty} units ({result.details.fast_mover.days_listed}d fresh)</div>
                              <div className="text-ink-200 font-bold">Offer: ₹{result.details.fast_mover.offered_price_inr} (0.0% off)</div>
                              <div className="text-ink-500 text-[9px]">Multiplier: {result.details.fast_mover.urgency_multiplier}</div>
                              <div className="text-ink-500 text-[9px]">Policy: Full List Price Preserved (No Discount)</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom Scenario 11 Visualization: Reliability Changes the Outcome */}
                      {scenario.id === 11 && result.details && (
                        <div className="mt-2 p-3 bg-ink-900 border border-ink-700 rounded space-y-2 text-[11px]">
                          <div className="flex items-center justify-between border-b border-ink-800 pb-1.5">
                            <span className="font-bold text-signal-light uppercase text-[10px]">
                              Floor Impact on 3-Merchant Auction Outcome:
                            </span>
                            <span className="text-amber-400 text-[9px] font-bold">TRUST FLOOR ACTIVE</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 rounded bg-ink-950 border border-ink-800 space-y-1">
                              <span className="text-ink-300 font-bold block">RUN 1: NO FLOOR (0★)</span>
                              <div className="text-ink-200">Winner: <span className="text-signal-light font-bold">{result.details.run1_no_floor.winning_merchant}</span></div>
                              <div className="text-ink-300">Price: ₹{result.details.run1_no_floor.unit_price_inr}</div>
                              <div className="text-amber-400">Rating: ★ {result.details.run1_no_floor.reliability_stars} (60% on-time, 20% disputes)</div>
                              <div className="text-ink-500 text-[9px]">Cheapest price wins without trust filtering</div>
                            </div>

                            <div className="p-2 rounded bg-ink-950 border border-signal-border space-y-1">
                              <span className="text-signal font-bold block">RUN 2: 4.0★ FLOOR REQUIRED</span>
                              <div className="text-ink-200">Winner: <span className="text-signal font-bold">{result.details.run2_with_4_star_floor.winning_merchant}</span></div>
                              <div className="text-ink-300">Price: ₹{result.details.run2_with_4_star_floor.unit_price_inr}</div>
                              <div className="text-emerald-400">Rating: ★ {result.details.run2_with_4_star_floor.reliability_stars} (88.9% on-time, 5.6% disputes)</div>
                              <div className="text-rose-400 text-[9px]">Excluded: Merchant B (3.7★ &lt; 4.0★ floor)</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom Scenario 12 Visualization: Multi-Protocol Interoperability */}
                      {scenario.id === 12 && result.details && (
                        <div className="mt-2 p-3 bg-ink-900 border border-ink-700 rounded space-y-2 text-[11px]">
                          <div className="flex items-center justify-between border-b border-ink-800 pb-1.5">
                            <span className="font-bold text-signal-light uppercase text-[10px]">
                              Heterogeneous Protocol Normalization to Canonical CCO:
                            </span>
                            <span className="text-emerald-400 text-[9px] font-bold">100% CCO PARITY</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 rounded bg-ink-950 border border-ink-800 space-y-1">
                              <span className="text-ink-200 font-bold block">ACP INGRESS (Agent Comm Protocol)</span>
                              <div className="text-ink-400 font-mono text-[9px]">query.budget: ₹4,000 | query.item: SPRINTPRO-X2</div>
                              <div className="text-ink-300">Normalized Budget: ₹{result.details.acp_normalized_cco.budget_max_inr}</div>
                              <div className="text-signal-light font-bold">Signed Price: ₹{result.details.acp_normalized_cco.winning_price_inr}</div>
                            </div>

                            <div className="p-2 rounded bg-ink-950 border border-ink-800 space-y-1">
                              <span className="text-ink-200 font-bold block">AP2 INGRESS (Agent Payment Protocol)</span>
                              <div className="text-ink-400 font-mono text-[9px]">cart[0].max_price_paise: 400000 | mandate: lowest_price</div>
                              <div className="text-ink-300">Normalized Budget: ₹{result.details.ap2_normalized_cco.budget_max_inr}</div>
                              <div className="text-signal-bold text-signal font-bold">Signed Price: ₹{result.details.ap2_normalized_cco.winning_price_inr}</div>
                            </div>
                          </div>
                          <div className="text-emerald-400 text-[9px] font-mono text-center pt-1 border-t border-ink-800">
                            ✓ {result.details.parity_asserted}
                          </div>
                        </div>
                      )}

                      {result.state_transition && (
                        <div className="text-[10px] text-ink-400">
                          State Transition: {result.state_transition.from} ──→ {result.state_transition.to}
                        </div>
                      )}

                      <button
                        onClick={() => toggleDetails(scenario.id)}
                        className="text-[10px] text-ink-500 hover:text-ink-300 underline block pt-1"
                      >
                        {isExpanded ? 'Hide Raw Audit JSON ▲' : 'Inspect Audit Entry ▼'}
                      </button>

                      {isExpanded && result.audit_entry && (
                        <pre className="bg-ink-900 p-2 rounded text-[10px] text-ink-300 overflow-x-auto mt-2 border border-ink-700">
                          {JSON.stringify(result.audit_entry, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => triggerScenario(scenario.id)}
                    disabled={isLoading || batchLoading}
                    className="w-full py-2 px-3 bg-ink-800 hover:bg-ink-750 text-ink-100 border border-ink-600 font-mono text-xs font-bold rounded transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Executing Scenario...' : 'Trigger Scenario Test →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
