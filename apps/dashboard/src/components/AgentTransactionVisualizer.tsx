'use client';

import React, { useState } from 'react';

export function AgentTransactionVisualizer() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const steps = [
    {
      num: 1,
      tag: 'PRE-AUTH MANDATE',
      title: '1-Time Authorization & Ceiling Binding',
      actorA: 'Human Buyer',
      actorB: 'NPCI / Razorpay Rails',
      badge: '₹1 Auth Tokenization',
      color: 'sky',
      desc: 'The human buyer establishes a hard spending ceiling (e.g., ₹4,000) with a one-time ₹1 authorization. NPCI/Razorpay issues an immutable token_id, allowing the buyer agent to autonomously pay up to that ceiling.',
      codeSnippet: `// 1-Time Setup Handshake
POST /api/mandates/register
{
  buyer_agent_id: "buyer-agent-auto-01",
  max_amount_inr: 4000.00,
  frequency: "as_presented",
  auth_charge: 100 // ₹1.00 token auth
}
// Response: { token_id: "token_ec002c98aa", status: "ACTIVE" }`,
    },
    {
      num: 2,
      tag: 'MULTI-TURN DIALOGUE',
      title: 'Gemini Agent-to-Agent Convergence',
      actorA: 'Buyer Agent (LLM)',
      actorB: 'Merchant Agent (LLM)',
      badge: 'Dual-AI Negotiation',
      color: 'amber',
      desc: 'The Buyer Agent initiates bids factoring in delivery deadlines and price constraints. The Merchant Agent counters using inventory-aware profit algorithms. Both are clamped by deterministic safety floors.',
      codeSnippet: `// Turn-by-Turn Game-Theoretic Concession
Round 1: Buyer Bids ₹3,869.00 (<24h Urgency Posture)
Round 2: Merchant Counters ₹3,949.00 (Inventory Clearance BLR-WH-01)
Round 3: Concession towards Pareto Optimum
Round 4: Mutual Consensus reached at ₹3,783.12`,
    },
    {
      num: 3,
      tag: 'CRYPTOGRAPHIC SEAL',
      title: 'HMAC-SHA256 Contract Signing',
      actorA: 'Merchant Security Module',
      actorB: 'Buyer Verification Agent',
      badge: 'Tamper-Proof Lock',
      color: 'emerald',
      desc: 'Upon reaching consensus, the canonical terms (price, SKU, quantity, SLA, return window, nonce, expiry) are serialized and signed using HMAC-SHA256. Neither agent can alter the terms post-handshake.',
      codeSnippet: `// Canonical Contract Payload
{
  offer_id: "off-agnt-76q77ket",
  sku: "SPRINTPRO-X2",
  final_price_paise: 378312,
  nonce: "6bdcd17a-46b5-45a8-b4cf-3927c27f44e3",
  signature: "3f92e4a415a5d4ae78903949bf9333b1e02a2421acd..."
}`,
    },
    {
      num: 4,
      tag: 'AUTONOMOUS SETTLEMENT',
      title: 'Server-to-Server Direct Recurring Charge',
      actorA: 'DealFlow Backend',
      actorB: 'Razorpay UPI Autopay Gateway',
      badge: '0 Human Clicks',
      color: 'indigo',
      desc: 'The backend verifies the contract signature against the buyer spending ceiling, then calls Razorpay server-to-server with the stored token_id. The bank processes the payment with zero checkout modals or OTPs.',
      codeSnippet: `// Autonomous S2S Payment Execution
POST /v1/payments/create/recurring
{
  token: "token_ec002c98aa",
  amount: 378312, // ₹3,783.12
  customer_id: "cust_b34c2642a8b301",
  order_id: "order_mnd_ce6f5c740b8c"
}
// Response: { payment_id: "pay_auto_1197aab6", status: "captured" }`,
    },
    {
      num: 5,
      tag: 'IMMUTABLE AUDIT',
      title: 'State Machine & Agent Decision Record',
      actorA: 'Audit Ledger Service',
      actorB: 'Merchant ERP / Fulfillment',
      badge: 'Sovereign Audit Trail',
      color: 'purple',
      desc: 'An immutable Agent Decision Record (ADR) logs all inputs considered and rejected alternatives. If the merchant breaches the guaranteed 48-hour SLA, the system automatically triggers an autonomous refund.',
      codeSnippet: `// ADR Governance & Audit Record
{
  decision_id: "adr_deal_mtljfrfn",
  inputs_considered: { budget_ceiling: 400000, urgency: "HIGH" },
  rejected_alternatives: ["Candidate B (₹4,199)", "Candidate A (₹3,949)"],
  final_decision: "Candidate C @ ₹3,783.12",
  sla_breach_protection: "AUTO_REFUND_GUARANTEE"
}`,
    },
  ];

  return (
    <div className="bg-ink-950 border border-ink-800 rounded-xl p-5 shadow-2xl mb-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-700/60 flex items-center justify-center text-sky-300 font-mono text-sm font-bold">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-ink-100 flex items-center gap-2">
              <span>Agent-to-Agent Autonomous Transaction Architecture</span>
              <span className="text-[10px] bg-signal/20 text-signal-light border border-signal/40 px-2 py-0.5 rounded font-mono">
                NPCI UAP + Razorpay Autopay
              </span>
            </h3>
            <p className="text-[11px] text-ink-400 font-sans mt-0.5">
              Interactive end-to-end trace of how autonomous AI agents discover, negotiate, sign, and settle with zero human intervention.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-mono text-ink-400 hover:text-ink-200 px-3 py-1 rounded bg-ink-900 border border-ink-800 transition-all"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand Flow ▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-5">
          {/* Animated Flow Pipeline Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            {steps.map((s) => {
              const isCurrent = activeStep === s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => setActiveStep(s.num)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isCurrent
                      ? 'bg-sky-950/70 border-sky-500 shadow-md shadow-sky-950/50'
                      : 'bg-ink-900/60 border-ink-800 hover:border-ink-700 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${isCurrent ? 'text-sky-300' : 'text-ink-400'}`}>
                      STAGE 0{s.num}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isCurrent ? 'bg-sky-900 text-sky-200' : 'bg-ink-800 text-ink-400'
                    }`}>
                      {s.tag}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-ink-100 truncate">
                    {s.title}
                  </div>
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Stage Detail Visualizer */}
          {(() => {
            const current = steps[activeStep - 1];
            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-ink-900/40 p-4 rounded-xl border border-ink-850">
                {/* Visual Actor Diagram */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-sky-400 font-bold uppercase tracking-wider">
                      Stage {current.num}: {current.title}
                    </span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                      {current.badge}
                    </span>
                  </div>

                  <p className="text-xs text-ink-300 font-sans leading-relaxed">
                    {current.desc}
                  </p>

                  {/* Interaction Diagram */}
                  <div className="p-3 bg-ink-950 rounded-lg border border-ink-800 flex items-center justify-between text-xs font-mono gap-2">
                    <div className="p-2.5 bg-sky-950/80 border border-sky-800/80 rounded-lg text-center flex-1">
                      <div className="text-base mb-1">🤖</div>
                      <div className="text-[11px] font-bold text-sky-300">{current.actorA}</div>
                      <div className="text-[9px] text-ink-400">Originator</div>
                    </div>

                    <div className="flex flex-col items-center justify-center px-2">
                      <span className="text-[9px] text-signal font-mono uppercase tracking-wider animate-pulse">
                        {current.tag}
                      </span>
                      <div className="flex items-center text-ink-500 font-bold">
                        <span>───►</span>
                      </div>
                      <span className="text-[8px] text-ink-400">Zero Human Friction</span>
                    </div>

                    <div className="p-2.5 bg-amber-950/60 border border-amber-800/80 rounded-lg text-center flex-1">
                      <div className="text-base mb-1">🏪</div>
                      <div className="text-[11px] font-bold text-amber-300">{current.actorB}</div>
                      <div className="text-[9px] text-ink-400">Recipient / Rails</div>
                    </div>
                  </div>
                </div>

                {/* Live Code / Payload Payload Inspector */}
                <div className="lg:col-span-6">
                  <div className="flex items-center justify-between text-[11px] font-mono text-ink-400 mb-1.5">
                    <span>TRANSACTION TELEMETRY PAYLOAD</span>
                    <span className="text-[10px] text-emerald-400">● LIVE PROOF</span>
                  </div>
                  <pre className="p-3 bg-ink-950 border border-ink-800 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[160px] leading-snug">
                    {current.codeSnippet}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
