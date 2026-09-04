'use client';

import React from 'react';
import Link from 'next/link';
import { DealLifecycleNav } from '../components/DealLifecycleNav';
import { useAuth } from '../components/AuthContext';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const isMerchant = user?.role === 'merchant';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Hero Command Banner */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  SYSTEM LIVE & INVARIANTS ACTIVE
                </span>
                <span className="text-slate-500 font-medium">Razorpay Test Mode</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">Neon PostgreSQL</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">HMAC-SHA256 Nonces</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
                Sovereign Deal Desk for <span className="text-[#0052CC]">Agentic Commerce</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed max-w-2xl">
                When autonomous AI buyer agents arrive with procurement mandates, DealFlow executes deterministic
                commercial policies, bounds 4-round agent negotiations, protects margins against machine-speed
                inventory races, and settles atomically via Razorpay.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
              <Link
                href="/deal-room"
                className="px-5 py-3 bg-[#0052CC] hover:bg-[#0747A6] text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs hover:shadow text-center flex items-center justify-center gap-2 active:scale-98"
              >
                <span>🤖 Enter Live Deal Room</span>
                <span>→</span>
              </Link>
              <Link
                href="/merchant-console"
                className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-2xs text-center flex items-center justify-center gap-2 active:scale-98"
              >
                <span>🏪 Merchant Console</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* System Health Indicators Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Protocol Ingress</span>
              <span className="text-slate-900 font-bold text-xs mt-0.5 block">ACP • AP2 • UCP • x402</span>
            </div>
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Pricing Math</span>
              <span className="text-[#0052CC] font-bold text-xs mt-0.5 block">Integer Paise Only</span>
            </div>
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Agent Negotiation</span>
              <span className="text-emerald-700 font-bold text-xs mt-0.5 block">4-Round Bounded</span>
            </div>
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Concurrency</span>
              <span className="text-amber-700 font-bold text-xs mt-0.5 block">Atomic Conditional</span>
            </div>
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Non-Repudiation</span>
              <span className="text-slate-900 font-bold text-xs mt-0.5 block">HMAC-SHA256 Nonce</span>
            </div>
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Test Verification</span>
              <span className="text-emerald-700 font-bold text-xs mt-0.5 block">33 E2E / 141 Pass</span>
            </div>
          </div>
        </section>

        {/* Operational Telemetry Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-1.5 shadow-sm hover:shadow-md transition-all">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Protocol Interoperability</div>
            <div className="text-2xl font-extrabold text-slate-900">4 Inbound Rails</div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              Universal CCO adapter normalizes ACP, Google AP2, UCP, and HTTP 402 into unified commerce objects.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-1.5 shadow-sm hover:shadow-md transition-all">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Margin Floor Protection</div>
            <div className="text-2xl font-extrabold text-[#0052CC]">18.0% Hard Floor</div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              Zero margin leakage. Part 2 inventory formula clears aged stock while strictly preserving profitability.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-1.5 shadow-sm hover:shadow-md transition-all">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Machine-Speed Concurrency</div>
            <div className="text-2xl font-extrabold text-emerald-700">Zero Overselling</div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              Atomic <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px]">WHERE inventory_qty &gt;= qty</code> conditional reservation prevents stock races.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-1.5 shadow-sm hover:shadow-md transition-all">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Audit Accountability</div>
            <div className="text-2xl font-extrabold text-slate-900">Agent Decision Records</div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              Structured logs capturing inputs considered, rejected candidate reasons, and winning rules.
            </p>
          </div>
        </section>

        {/* Primary Functional Modules Launchpad */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="text-[#0052CC]">⚡</span>
              <span>Core Protocol Modules</span>
              <span className="text-xs font-normal text-slate-500">(Select a cockpit view)</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Active Role: {isMerchant ? 'Merchant Operator' : 'Autonomous Buyer'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Deal Room */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    🤖
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    SINGLE-MERCHANT
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Deal Room & Agent Negotiation
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Autonomous 2-role negotiation engine capped at 4 rounds. Features deadline-aware posture
                    (&lt;24h urgency dialogue), deterministic price clamping, and automatic fallback.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Instant Razorpay Checkout</span>
                <Link
                  href="/deal-room"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  Enter Deal Room →
                </Link>
              </div>
            </div>

            {/* Card 2: Merchant Console */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    🏪
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    MERCHANT-ONLY
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Merchant Console & Explainability
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Per-product "Why am I discounting this" explainability panel. Evaluates inventory aging, movement rates,
                    predicted profit delta, policy floors, and human escalations.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Zero Margin Leakage</span>
                <Link
                  href="/merchant-console"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  Open Console →
                </Link>
              </div>
            </div>

            {/* Card 3: 3-Merchant Auction */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    🏛
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                    MULTI-MERCHANT
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Reliability-Weighted Auction
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Parallel RFP broadcast to 3 competing merchants. Evaluates multi-attribute utility blending
                    price, SLA, and warranty against dynamic merchant reliability scores and trust floors.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Quality-Aware Ranking</span>
                <Link
                  href="/auction"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  Launch Auction →
                </Link>
              </div>
            </div>

            {/* Card 4: Audit Ledger */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    📜
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                    IMMUTABLE LEDGER
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Audit Ledger & Decision Records
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Readable, structured Agent Decision Records in Neon PostgreSQL. Surfaces inputs considered,
                    rejected alternatives with specific loss reasons, and cryptographic nonces.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Non-Repudiation Audit</span>
                <Link
                  href="/audit"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  View Audit Ledger →
                </Link>
              </div>
            </div>

            {/* Card 5: Invariant Failure Mode Scenarios */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    🧪
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    12 SCENARIOS
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Invariant Scenarios & Test Suite
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Live verification cockpit. Test accept-time inventory races, digit flip tampering, payment failure
                    recovery, and multi-protocol equivalence (ACP vs AP2 vs UCP vs x402).
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Automated Edge Cases</span>
                <Link
                  href="/scenarios"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  Run Scenarios →
                </Link>
              </div>
            </div>

            {/* Card 6: Live WebSocket Feed */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                    ⚡
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                    STREAM
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052CC] transition-colors">
                    Live Feed & Telemetry
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                    Chronological stream of real-time negotiation events, state transitions, HMAC seals, and webhook
                    settlement confirmations.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Real-Time State Feed</span>
                <Link
                  href="/live-feed"
                  className="text-xs font-semibold text-[#0052CC] hover:text-[#0747A6] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  View Live Feed →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Architectural Lifecycle Flowchart */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase text-slate-800 tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0052CC]" />
              <span>DealFlow End-to-End Processing Pipeline</span>
            </h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Zero State-Jumping Enforced
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">01. INGEST</div>
              <div className="text-slate-900 font-semibold text-xs">Universal CCO</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Normalizes ACP, AP2, UCP, or x402 into standard CCO.</div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">02. POLICY</div>
              <div className="text-slate-900 font-semibold text-xs">Guardrail Math</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Enforces 18% margin floor and 12% max discount in integer paise.</div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">03. NEGOTIATE</div>
              <div className="text-slate-900 font-semibold text-xs">Bounded 4-Round</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Buyer & merchant agents converse with deadline-aware urgency.</div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">04. CRYPTO</div>
              <div className="text-slate-900 font-semibold text-xs">HMAC Signing</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Seals canonical JSON terms with single-use anti-replay nonces.</div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">05. CONCURRENCY</div>
              <div className="text-slate-900 font-semibold text-xs">Atomic Reserve</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Conditional SQL update prevents race conditions and overselling.</div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[#0052CC] font-bold text-xs">06. SETTLE</div>
              <div className="text-slate-900 font-semibold text-xs">Razorpay Capture</div>
              <div className="text-[11px] text-slate-600 font-sans leading-relaxed">Links 1:1 order, verifies webhook HMAC, and writes to audit log.</div>
            </div>
          </div>
        </section>
      </main>

      {/* Persistent Modern Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-500">
          <div className="flex items-center gap-2">
            <strong className="text-slate-800 font-semibold">Razorpay DealFlow</strong>
            <span>&bull;</span>
            <span>Sovereign Deal Desk for Agentic Commerce</span>
          </div>
          <div className="flex items-center gap-5 text-slate-600 font-medium">
            <Link href="/" className="text-[#0052CC] font-semibold">Overview</Link>
            <Link href="/merchant-console" className="hover:text-slate-900 transition-colors">Merchant Console</Link>
            <Link href="/deal-room" className="hover:text-slate-900 transition-colors">Deal Room</Link>
            <Link href="/auction" className="hover:text-slate-900 transition-colors">Auction</Link>
            <Link href="/audit" className="hover:text-slate-900 transition-colors">Audit Ledger</Link>
            <Link href="/scenarios" className="hover:text-slate-900 transition-colors">Scenarios</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
