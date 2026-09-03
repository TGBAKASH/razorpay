'use client';

import React, { useState } from 'react';

export function AgentTransactionVisualizer({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs mb-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-bold font-sans text-slate-900 flex items-center gap-2">
              <span>Agent-to-Agent Autonomous Transaction Architecture</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                NPCI UAP + Razorpay Autopay
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Interactive end-to-end trace of how autonomous AI agents discover, negotiate, sign, and settle with zero human intervention.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand Flow ▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Animated Flow Pipeline Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-sans text-xs">
            {steps.map((s) => {
              const isCurrent = activeStep === s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => setActiveStep(s.num)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isCurrent
                      ? 'bg-white border-blue-600 shadow-xs'
                      : 'bg-slate-100/70 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>
                      STAGE 0{s.num}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isCurrent ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {s.tag}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {s.title}
                  </div>
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Stage Detail Visualizer */}
          {(() => {
            const current = steps[activeStep - 1];
            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                {/* Visual Actor Diagram */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-slate-900 font-bold uppercase tracking-wider">
                      Stage {current.num}: {current.title}
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      {current.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-sans leading-relaxed">
                    {current.desc}
                  </p>

                  {/* Interaction Diagram */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-sans gap-2">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center flex-1 shadow-2xs">
                      <div className="text-xs font-bold text-slate-900">{current.actorA}</div>
                      <div className="text-[10px] text-slate-500">Originator</div>
                    </div>

                    <div className="flex flex-col items-center justify-center px-2">
                      <span className="text-[9px] text-blue-700 font-mono uppercase tracking-wider font-bold">
                        {current.tag}
                      </span>
                      <div className="flex items-center text-slate-400 font-bold text-xs">
                        <span>───►</span>
                      </div>
                      <span className="text-[8px] text-slate-500">Autonomous</span>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center flex-1 shadow-2xs">
                      <div className="text-xs font-bold text-slate-900">{current.actorB}</div>
                      <div className="text-[10px] text-slate-500">Recipient / Rails</div>
                    </div>
                  </div>
                </div>

                {/* Live Code / Payload Payload Inspector */}
                <div className="lg:col-span-6">
                  <div className="flex items-center justify-between text-[11px] font-sans text-slate-500 mb-1.5">
                    <span className="font-semibold uppercase">Telemetry Payload</span>
                    <span className="text-emerald-700 font-semibold">● Live Proof</span>
                  </div>
                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[160px] leading-snug">
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
