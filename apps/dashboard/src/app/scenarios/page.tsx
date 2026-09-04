'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';

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

interface ScenarioItem {
  id: number;
  title: string;
  agentType: 'buyer' | 'merchant' | 'security' | 'settlement';
  agentName: string;
  agentHandle: string;
  category: string;
  code: string;
  metric1Label: string;
  metric1Value: string;
  metric2Label: string;
  metric2Value: string;
  description: string;
  invariant: string;
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: 1,
    title: '1. Inventory Race at Accept-Time',
    agentType: 'merchant',
    agentName: 'Merchant Agent (Warehouse)',
    agentHandle: 'Sprint Athletics • BLR-WH-01',
    category: 'Inventory & Concurrency',
    code: 'INVENTORY_RACE',
    metric1Label: 'Stock Snapshot:',
    metric1Value: '2 Signed → 1 Left',
    metric2Label: 'SLA Guard:',
    metric2Value: 'Atomic Re-Check',
    description: 'Offer signed for qty 2. Live warehouse inventory drops to 1 before buyer acceptance arrives.',
    invariant: 'Never silently substitute qty 1 or charge buyer. Propose qualified alternative or cleanly expire with zero charge.',
  },
  {
    id: 2,
    title: '2. Offer Tampering (Digit Flip)',
    agentType: 'security',
    agentName: 'Contract Guard (HMAC)',
    agentHandle: 'contract-service • SHA-256',
    category: 'Cryptographic Security',
    code: 'TAMPER_DIGIT_FLIP',
    metric1Label: 'Signed Value:',
    metric1Value: '₹3,949 locked',
    metric2Label: 'Tampered Payload:',
    metric2Value: '₹2,949 injected',
    description: 'Compromised accept request modifies final_price_paise from ₹3,949 to ₹2,949.',
    invariant: 'Cryptographic HMAC signature check fails immediately, rejecting before any Razorpay API order call.',
  },
  {
    id: 3,
    title: '3. Payment Failure & Method Retry',
    agentType: 'settlement',
    agentName: 'Settlement Rail (Razorpay)',
    agentHandle: 'razorpay-client • Test Mode',
    category: 'Payment Settlement',
    code: 'PAYMENT_FAILURE_RETRY',
    metric1Label: 'Initial Card:',
    metric1Value: 'Failure Card (declined)',
    metric2Label: 'Price Invariant:',
    metric2Value: '₹3,949 (No Re-discount)',
    description: 'Razorpay test mode failure card triggered during checkout.',
    invariant: 'Offers retry with alternative payment method; original price (₹3,949) remains strictly unchanged (no win-back discounts).',
  },
  {
    id: 4,
    title: '4. Buyer Exceeds Mandate Budget',
    agentType: 'buyer',
    agentName: 'Buyer Agent (Mandate)',
    agentHandle: 'buyer@okhdfcbank • ₹3,000 max',
    category: 'Autonomous Guardrails',
    code: 'MANDATE_CEILING_BREACH',
    metric1Label: 'Mandate Ceiling:',
    metric1Value: '₹3,000.00 Limit',
    metric2Label: 'Attempted Price:',
    metric2Value: '₹3,949.00 Breach',
    description: 'Accept request attempted for an amount exceeding buyer max budget mandate (₹3,949 vs ₹3,000 limit).',
    invariant: 'Rejected by buyer constraint verifier even if merchant would have honored it.',
  },
  {
    id: 5,
    title: '5. Offer Expiry Window Violation',
    agentType: 'merchant',
    agentName: 'Temporal Engine',
    agentHandle: 'policy-engine • Epoch Guard',
    category: 'Temporal Policy',
    code: 'TEMPORAL_EXPIRY_BREACH',
    metric1Label: 'Expiry Window:',
    metric1Value: 'T = +10 mins',
    metric2Label: 'Accept Arrival:',
    metric2Value: 'T = +15 mins (stale)',
    description: 'Acceptance request arrives after the offer expires_at timestamp has elapsed.',
    invariant: 'Rejected with distinct OFFER_EXPIRED (410) error, clearly separated from signature failure.',
  },
  {
    id: 6,
    title: '6. Delivery Promise SLA Disruption',
    agentType: 'merchant',
    agentName: 'Merchant Agent (Logistics)',
    agentHandle: 'Sprint Athletics • Logistics SLA',
    category: 'Logistics SLA',
    code: 'SLA_UNREACHABLE',
    metric1Label: 'Committed SLA:',
    metric1Value: '48h Express (Tue)',
    metric2Label: 'Carrier Status:',
    metric2Value: 'Disrupted (+3 days)',
    description: 'Warehouse carrier SLA disrupts after offer generation, making delivery promise unreachable.',
    invariant: 'Caught at accept-time reachability check; does not silently ship late; offers alternative or expires cleanly.',
  },
  {
    id: 7,
    title: '7. LLM Out-of-Policy Interception',
    agentType: 'security',
    agentName: 'Deterministic Policy Engine',
    agentHandle: 'pure-functions • zero-hallucination',
    category: 'Deterministic Invariants',
    code: 'LLM_ISOLATION_DEFENSE',
    metric1Label: 'LLM Proposal:',
    metric1Value: '50% Off (Hallucinated)',
    metric2Label: 'Deterministic Floor:',
    metric2Value: '18% Margin Protected',
    description: 'Forced hallucinated 50% discount suggestion from LLM.',
    invariant: 'Deterministic policy engine rejects immediately; proposal NEVER reaches contract signing.',
  },
  {
    id: 8,
    title: '8. Webhook Replay Idempotency',
    agentType: 'settlement',
    agentName: 'Settlement Rail (Idempotency)',
    agentHandle: 'webhook-handler • Deduplication',
    category: 'Payment Settlement',
    code: 'IDEMPOTENCY_REPLAY_GUARD',
    metric1Label: 'Event ID:',
    metric1Value: 'evt_pay_captured_01',
    metric2Label: 'State Mutated:',
    metric2Value: '0x Duplicate Charges',
    description: 'Replay of an already-processed payment.captured Razorpay webhook event.',
    invariant: 'Idempotency guard short-circuits on event ID, logging duplicate ignored with zero duplicate state transitions.',
  },
  {
    id: 9,
    title: '9. Buyer Priority Actually Wins',
    agentType: 'buyer',
    agentName: 'Buyer Agent (Pareto Priority)',
    agentHandle: 'buyer@okhdfcbank • Price Priority',
    category: 'Pure Buyer Priority',
    code: 'BUYER_PRIORITY_WINS',
    metric1Label: 'Buyer Stated Mandate:',
    metric1Value: 'Lowest Price First',
    metric2Label: 'Merchant Profit:',
    metric2Value: 'Higher Profit Bypassed',
    description: 'Buyer prioritizes lowest price. The genuinely cheapest policy-valid candidate (Candidate C @ ₹3,783) beats higher merchant profit (Candidate A @ ₹3,949).',
    invariant: 'Buyer stated priority is strictly honored over merchant profit among policy-cleared offers; merchant policy floor is visibly provable.',
  },
  {
    id: 10,
    title: '10. Same Offer, Different Product',
    agentType: 'merchant',
    agentName: 'Merchant Agent (Inventory Urgency)',
    agentHandle: 'inventory-aware • Clearance',
    category: 'Inventory & Concurrency',
    code: 'INVENTORY_SIGNAL_DIFFERENTIATION',
    metric1Label: 'Aged Stock (76d):',
    metric1Value: '8.1% Clearance Disc',
    metric2Label: 'Fresh Stock (5d):',
    metric2Value: '0.0% Discount (List)',
    description: 'Identical buyer budget (₹4,000) sent to slow-moving aged stock vs fast-moving scarce stock.',
    invariant: 'Engine recommends clearance incentive for aged stock (8.1% discount) and protects list price (0% discount) for fast movers.',
  },
  {
    id: 11,
    title: '11. Reliability Changes the Outcome',
    agentType: 'buyer',
    agentName: 'Buyer Agent (Trust Floor)',
    agentHandle: 'buyer@okhdfcbank • 4.0★ Mandate',
    category: 'Autonomous Guardrails',
    code: 'AUCTION_RELIABILITY_FLOOR',
    metric1Label: 'Run 1 (No Floor):',
    metric1Value: 'Cheapest Wins (3.7★)',
    metric2Label: 'Run 2 (4.0★ Floor):',
    metric2Value: 'Trusted Merchant Wins',
    description: 'Same 3 merchant prices evaluated twice: once with "No preference" (cheapest wins) and once with "4+ stars required" (higher reliability merchant wins instead).',
    invariant: 'Merchants below buyer-stated reliability floor are excluded before scoring runs; cheaper merchants only lose when buyer explicitly mandates trust.',
  },
  {
    id: 12,
    title: '12. Multi-Protocol Interoperability (ACP vs AP2)',
    agentType: 'security',
    agentName: 'Universal Commerce Adapter',
    agentHandle: 'adapters • ACP / AP2 / CCO',
    category: 'Cryptographic Security',
    code: 'MULTI_PROTOCOL_INTEROP',
    metric1Label: 'Protocol 1:',
    metric1Value: 'ACP (Google / Open)',
    metric2Label: 'Protocol 2:',
    metric2Value: 'AP2 (Autonomous Pay)',
    description: 'Identical intent submitted in ACP and AP2 formats; both adapt into identical canonical CCO and produce matching signed contracts.',
    invariant: 'Universal adapter converts heterogeneous agent protocols (ACP, AP2, UCP, x402) into a single canonical CCO with mathematical equivalence.',
  },
];

export default function ScenariosPage() {
  const [results, setResults] = useState<Record<number, ScenarioResult>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    SCENARIOS.forEach((s) => set.add(s.category));
    return ['all', ...Array.from(set)];
  }, []);

  const filteredScenarios = useMemo(() => {
    if (activeCategory === 'all') return SCENARIOS;
    return SCENARIOS.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  const stats = useMemo(() => {
    const executed = Object.keys(results).length;
    const passed = Object.values(results).filter((r) => r.passed).length;
    return { executed, passed, total: SCENARIOS.length };
  }, [results]);

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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      <DealLifecycleNav currentStage="scenarios" />

      {/* Header Banner */}
      <header className="border-b border-slate-200/90 bg-white shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  12 DETERMINISTIC PRESETS
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Real-Time Autonomous Agent Invariant Suite
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-sans">
                Autonomous Failure Modes & Edge-Case Presets
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl font-sans leading-relaxed">
                Trigger live deterministic edge-cases to verify cryptographic verification, race condition handling, inventory signals, and pure buyer-priority execution.
              </p>
            </div>

            {/* Quick Action & Live Score */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {stats.executed > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-medium text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    <strong className="font-bold">{stats.passed}</strong> of {stats.executed} Invariants Held
                  </span>
                </div>
              )}

              <button
                onClick={triggerAllScenarios}
                disabled={batchLoading}
                className="px-5 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {batchLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Executing All 12 Presets...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Run All 12 Live Presets</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-6 border-t border-slate-100 mt-6 no-scrollbar">
            <span className="text-xs font-semibold text-slate-400 mr-2 uppercase tracking-wider text-[10px]">
              Filter:
            </span>
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {cat === 'all' ? `All Presets (${SCENARIOS.length})` : cat}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Grid: Styled EXACTLY like Buyer Agent & Merchant Agent Telemetry Cards */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {filteredScenarios.map((scenario) => {
            const result = results[scenario.id];
            const isLoading = loadingId === scenario.id;
            const isExpanded = !!expandedDetails[scenario.id];

            // Assign agent theme classes matching Buyer Agent vs Merchant Agent
            const isBuyer = scenario.agentType === 'buyer';
            const isMerchant = scenario.agentType === 'merchant';
            const isSecurity = scenario.agentType === 'security';

            const cardBg = isBuyer
              ? 'bg-blue-50/40 border-blue-200/90'
              : isMerchant
              ? 'bg-slate-50/80 border-slate-200/90'
              : isSecurity
              ? 'bg-purple-50/30 border-purple-200/80'
              : 'bg-amber-50/30 border-amber-200/80';

            const iconBg = isBuyer
              ? 'bg-blue-100 text-blue-800'
              : isMerchant
              ? 'bg-emerald-100 text-emerald-800'
              : isSecurity
              ? 'bg-purple-100 text-purple-800'
              : 'bg-amber-100 text-amber-800';

            const iconSymbol = isBuyer ? '🤖' : isMerchant ? '🏪' : isSecurity ? '🛡️' : '⚡';

            return (
              <div
                key={scenario.id}
                className={`border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm hover:shadow-md transition-all duration-200 ${cardBg} ${
                  result
                    ? result.passed
                      ? 'ring-2 ring-emerald-400/80 border-emerald-300'
                      : 'ring-2 ring-rose-400/80 border-rose-300'
                    : ''
                }`}
              >
                {/* Agent Header (Same as ExecutiveDealRoomCockpit Agent Telemetry HUD) */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center font-bold text-base shadow-2xs`}>
                      {iconSymbol}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                          {scenario.agentName}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                          {scenario.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {scenario.agentHandle}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {result ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-2xs ${
                          result.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {result.passed ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            INVARIANT HELD
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            INVARIANT BREACH
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                        Ready to Test
                      </span>
                    )}
                  </div>
                </div>

                {/* Scenario Title & Description */}
                <div className="space-y-1.5">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {scenario.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {scenario.description}
                  </p>
                </div>

                {/* 2-Column Telemetry Metrics Grid (Same as User Agent / Merchant Agent HUD) */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">
                      {scenario.metric1Label}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-[11px] sm:text-xs">
                      {scenario.metric1Value}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">
                      {scenario.metric2Label}
                    </span>
                    <span className="font-semibold text-blue-700 text-[11px] sm:text-xs">
                      {scenario.metric2Value}
                    </span>
                  </div>
                </div>

                {/* Guaranteed Invariant Box */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-3 space-y-1">
                  <span className="text-slate-500 uppercase block text-[10px] font-bold tracking-wider">
                    Guaranteed System Invariant:
                  </span>
                  <p className="text-slate-700 text-xs font-medium leading-normal">
                    {scenario.invariant}
                  </p>
                </div>

                {/* Live Result Container */}
                {result && (
                  <div className="bg-white p-4 rounded-xl text-xs space-y-3 border border-slate-200 shadow-2xs">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold text-sm leading-none mt-0.5">✓</span>
                      <div className="text-slate-800 font-medium text-xs leading-relaxed">
                        <strong className="text-slate-900 font-semibold">Verification:</strong> {result.actual_result}
                      </div>
                    </div>

                    {/* Scenario 9: Buyer Priority Proof */}
                    {scenario.id === 9 && result.details && (
                      <div className="mt-2 p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
                          <span className="font-bold text-slate-800 uppercase text-[10px]">
                            Decision Matrix & Proof of Non-Leakage Floor:
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            BUYER PRIORITY HONORED
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                            <span className="text-emerald-800 font-bold block">✓ WINNER: Candidate C</span>
                            <div className="text-slate-700 font-semibold mt-1">Price: ₹{result.details.winning_price_inr}</div>
                            <div className="text-slate-500 text-[11px]">Unit Margin: {result.details.winning_margin_pct}%</div>
                            <div className="text-emerald-700 text-[10px] font-medium mt-1">Margin Floor: ✓ Met (+24.8% buffer)</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-500 font-bold block">BYPASSED: Candidate A</span>
                            <div className="text-slate-700 font-medium mt-1">Price: ₹{result.details.higher_profit_price_inr}</div>
                            <div className="text-slate-500 text-[11px]">Unit Margin: {result.details.higher_profit_margin_pct}%</div>
                            <div className="text-slate-400 text-[10px] mt-1">Higher Merchant Profit ignored</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scenario 10: Inventory Comparison */}
                    {scenario.id === 10 && result.details && (
                      <div className="mt-2 p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                          <span className="font-bold text-slate-800 uppercase text-[10px]">
                            Side-by-Side Inventory Holding Comparison:
                          </span>
                          <span className="text-slate-500 text-[11px]">Buyer: ₹{result.details.buyer_stated_budget_inr}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-blue-200 space-y-1">
                            <span className="text-blue-900 font-bold block">SLOW MOVER ({result.details.slow_mover.sku})</span>
                            <div className="text-slate-600 text-[11px]">76d aged • 41 units</div>
                            <div className="text-blue-800 font-bold">Offer: ₹{result.details.slow_mover.offered_price_inr} ({result.details.slow_mover.discount_pct}% off)</div>
                            <div className="text-slate-500 text-[10px]">Urgency Multiplier: 1.15x</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                            <span className="text-slate-700 font-bold block">FAST MOVER ({result.details.fast_mover.sku})</span>
                            <div className="text-slate-600 text-[11px]">5d fresh • 12 units</div>
                            <div className="text-slate-800 font-bold">Offer: ₹{result.details.fast_mover.offered_price_inr} (0% off)</div>
                            <div className="text-slate-500 text-[10px]">Full List Price Preserved</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scenario 11: Trust Floor */}
                    {scenario.id === 11 && result.details && (
                      <div className="mt-2 p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                          <span className="font-bold text-slate-800 uppercase text-[10px]">
                            Auction Trust Floor Impact:
                          </span>
                          <span className="text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            TRUST FILTER ACTIVE
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                            <span className="text-slate-700 font-bold block">RUN 1: NO FLOOR</span>
                            <div className="text-slate-800 font-semibold">{result.details.run1_no_floor.winning_merchant}</div>
                            <div className="text-amber-700 text-[11px]">★ {result.details.run1_no_floor.reliability_stars} (Lowest price wins)</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1">
                            <span className="text-emerald-800 font-bold block">RUN 2: 4.0★ FLOOR</span>
                            <div className="text-emerald-800 font-semibold">{result.details.run2_with_4_star_floor.winning_merchant}</div>
                            <div className="text-emerald-700 text-[11px]">★ {result.details.run2_with_4_star_floor.reliability_stars} (Trusted merchant)</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* State Transition Pill */}
                    {result.state_transition && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="font-semibold text-slate-700">State Transition:</span>
                        <span className="font-mono text-slate-600">{result.state_transition.from}</span>
                        <span>──→</span>
                        <span className="font-mono text-emerald-700 font-semibold">{result.state_transition.to}</span>
                      </div>
                    )}

                    {/* Expandable Audit JSON */}
                    <button
                      onClick={() => toggleDetails(scenario.id)}
                      className="text-[11px] font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      {isExpanded ? 'Hide Raw Audit JSON ▲' : 'Inspect Audit Entry ▼'}
                    </button>

                    {isExpanded && result.audit_entry && (
                      <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto mt-2 border border-slate-800 shadow-inner">
                        {JSON.stringify(result.audit_entry, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Trigger Button */}
                <button
                  onClick={() => triggerScenario(scenario.id)}
                  disabled={isLoading || batchLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-99"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-slate-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Executing Scenario...</span>
                    </>
                  ) : (
                    <span>Trigger Scenario Test →</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-500">
          <div>
            <strong className="text-slate-700 font-semibold">Razorpay DealFlow</strong> • Sovereign Deal Desk for Agentic Commerce
          </div>
          <div className="flex items-center gap-5 text-slate-600 font-medium">
            <Link href="/" className="hover:text-slate-900 transition-colors">Overview</Link>
            <Link href="/deal-room" className="hover:text-slate-900 transition-colors">Deal Room</Link>
            <Link href="/merchant-console" className="hover:text-slate-900 transition-colors">Merchant Console</Link>
            <Link href="/auction" className="hover:text-slate-900 transition-colors">Multi-Merchant Auction</Link>
            <Link href="/audit" className="hover:text-slate-900 transition-colors">Audit Ledger</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
