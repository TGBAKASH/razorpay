'use client';

import React from 'react';
import Link from 'next/link';
import { DealLifecycleNav } from '../components/DealLifecycleNav';
import { useAuth } from '../components/AuthContext';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const isMerchant = user?.role === 'merchant';

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between selection:bg-signal selection:text-white">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Hero Command Banner */}
        <section className="bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 border border-ink-700 rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-signal/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-full bg-signal-bg text-signal border border-signal-border font-bold">
                  ● SYSTEM LIVE & INVARIANTS ACTIVE
                </span>
                <span className="text-ink-400">Razorpay Test Mode</span>
                <span className="text-ink-600">•</span>
                <span className="text-ink-400">Neon PostgreSQL</span>
                <span className="text-ink-600">•</span>
                <span className="text-ink-400">HMAC-SHA256 Nonces</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-white">
                Sovereign Deal Desk for <span className="text-signal-light">Agentic Commerce</span>
              </h1>

              <p className="text-sm sm:text-base text-ink-300 font-sans leading-relaxed">
                When autonomous AI buyer agents arrive with complex mandates, DealFlow executes deterministic
                commercial policies, bounds 4-round agent negotiations, protects margins against machine-speed
                inventory races, and settles atomically via Razorpay.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
              <Link
                href="/deal-room"
                className="px-5 py-2.5 bg-signal hover:bg-signal-hover text-white font-mono font-bold text-xs rounded transition-all shadow-md text-center flex items-center justify-center gap-2"
              >
                <span>🤖 Enter Live Deal Room</span>
                <span>→</span>
              </Link>
              <Link
                href="/merchant-console"
                className="px-5 py-2.5 bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-600 font-mono font-bold text-xs rounded transition-all text-center flex items-center justify-center gap-2"
              >
                <span>🏪 Merchant Console</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* System Health Indicators Bar */}
          <div className="mt-6 pt-6 border-t border-ink-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Protocol Ingress</span>
              <span className="text-ink-200 font-bold">ACP • AP2 • UCP • x402</span>
            </div>
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Pricing Math</span>
              <span className="text-signal-light font-bold">Integer Paise Only</span>
            </div>
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Agent Negotiation</span>
              <span className="text-emerald-400 font-bold">4-Round Bounded</span>
            </div>
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Concurrency</span>
              <span className="text-amber-300 font-bold">Atomic Conditional</span>
            </div>
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Non-Repudiation</span>
              <span className="text-ink-200 font-bold">HMAC-SHA256 Nonce</span>
            </div>
            <div className="bg-ink-950/60 p-2.5 rounded border border-ink-800/80">
              <span className="text-ink-500 block text-[10px] uppercase">Test Verification</span>
              <span className="text-emerald-400 font-bold">28 Suites / 135 Pass</span>
            </div>
          </div>
        </section>

        {/* Operational Telemetry Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-1 relative overflow-hidden">
            <div className="text-xs font-mono text-ink-400 uppercase tracking-wider">Protocol Interoperability</div>
            <div className="text-2xl font-display font-black text-white">4 Inbound Rails</div>
            <p className="text-xs text-ink-400 font-sans">
              Universal CCO adapter normalizes ACP, Google AP2, UCP, and HTTP 402 into unified commerce objects.
            </p>
          </div>

          <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-1 relative overflow-hidden">
            <div className="text-xs font-mono text-ink-400 uppercase tracking-wider">Margin Floor Protection</div>
            <div className="text-2xl font-display font-black text-signal-light">18.0% Hard Floor</div>
            <p className="text-xs text-ink-400 font-sans">
              Zero margin leakage. Part 2 inventory formula clears aged stock while strictly preserving profitability.
            </p>
          </div>

          <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-1 relative overflow-hidden">
            <div className="text-xs font-mono text-ink-400 uppercase tracking-wider">Machine-Speed Concurrency</div>
            <div className="text-2xl font-display font-black text-emerald-400">Zero Overselling</div>
            <p className="text-xs text-ink-400 font-sans">
              Atomic <code className="text-ink-200">WHERE inventory_qty &gt;= qty</code> conditional reservation prevents stock races.
            </p>
          </div>

          <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-1 relative overflow-hidden">
            <div className="text-xs font-mono text-ink-400 uppercase tracking-wider">Audit Accountability</div>
            <div className="text-2xl font-display font-black text-white">Agent Decision Records</div>
            <p className="text-xs text-ink-400 font-sans">
              Structured logs capturing inputs considered, rejected candidate reasons, and winning rules.
            </p>
          </div>
        </section>

        {/* Primary Functional Modules Launchpad */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <span>⚡ Core Protocol Modules</span>
              <span className="text-xs font-mono text-ink-500 font-normal">(Select a cockpit view)</span>
            </h2>
            <span className="text-xs font-mono text-signal font-bold">
              Active Role: {isMerchant ? 'Merchant Operator' : 'Autonomous Buyer'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Deal Room */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🤖</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-signal-bg text-signal border border-signal-border font-bold">
                    SINGLE-MERCHANT
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Deal Room & Agent Negotiation
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Autonomous 2-role negotiation engine capped at 4 rounds. Features deadline-aware posture
                    (&lt;24h urgency dialogue), deterministic price clamping, and automatic fallback.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Instant Razorpay Checkout</span>
                <Link
                  href="/deal-room"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  Enter Deal Room →
                </Link>
              </div>
            </div>

            {/* Card 2: Merchant Console */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🏪</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 text-ink-300 border border-ink-600 font-bold">
                    MERCHANT-ONLY
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Merchant Console & Explainability
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Per-product "Why am I discounting this" explainability panel. Evaluates inventory aging, movement rates,
                    predicted profit delta, policy floors, and human escalations.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Zero Margin Leakage</span>
                <Link
                  href="/merchant-console"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  Open Console →
                </Link>
              </div>
            </div>

            {/* Card 3: 3-Merchant Auction */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🏛</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    MULTI-MERCHANT
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Reliability-Weighted Auction
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Parallel RFP broadcast to 3 competing merchants. Evaluates multi-attribute utility blending
                    price, SLA, and warranty against dynamic merchant reliability scores and trust floors.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Quality-Aware Ranking</span>
                <Link
                  href="/auction"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  Launch Auction →
                </Link>
              </div>
            </div>

            {/* Card 4: Audit Ledger */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📜</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 text-ink-300 border border-ink-600 font-bold">
                    IMMUTABLE LEDGER
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Audit Ledger & Decision Records
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Readable, structured Agent Decision Records in Neon PostgreSQL. Surfaces inputs considered,
                    rejected alternatives with specific loss reasons, and cryptographic nonces.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Non-Repudiation Audit</span>
                <Link
                  href="/audit"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  View Audit Ledger →
                </Link>
              </div>
            </div>

            {/* Card 5: Invariant Failure Mode Scenarios */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🧪</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                    12 SCENARIOS
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Invariant Scenarios & Test Suite
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Live verification cockpit. Test accept-time inventory races, digit flip tampering, payment failure
                    recovery, and multi-protocol equivalence (ACP vs AP2 vs UCP vs x402).
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Automated Edge Cases</span>
                <Link
                  href="/scenarios"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  Run Scenarios →
                </Link>
              </div>
            </div>

            {/* Card 6: Live WebSocket Feed */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 flex flex-col justify-between hover:border-signal/70 transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⚡</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold">
                    STREAM
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-signal-light transition-colors">
                    Live Feed & Telemetry
                  </h3>
                  <p className="text-xs text-ink-400 mt-1 leading-relaxed font-sans">
                    Chronological stream of real-time negotiation events, state transitions, HMAC seals, and webhook
                    settlement confirmations.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ink-500">Real-Time State Feed</span>
                <Link
                  href="/live-feed"
                  className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                >
                  View Live Feed →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Architectural Lifecycle Flowchart */}
        <section className="bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold uppercase text-ink-200 tracking-wider">
              DealFlow End-to-End Processing Pipeline
            </h2>
            <span className="text-xs font-mono text-emerald-400 font-bold">Zero State-Jumping Enforced</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">01. INGEST</div>
              <div className="text-ink-100 font-semibold">Universal CCO</div>
              <div className="text-[11px] text-ink-400 font-sans">Normalizes ACP, AP2, UCP, or x402 into standard CCO.</div>
            </div>

            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">02. POLICY</div>
              <div className="text-ink-100 font-semibold">Guardrail Math</div>
              <div className="text-[11px] text-ink-400 font-sans">Enforces 18% margin floor and 12% max discount in integer paise.</div>
            </div>

            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">03. NEGOTIATE</div>
              <div className="text-ink-100 font-semibold">Bounded 4-Round</div>
              <div className="text-[11px] text-ink-400 font-sans">Buyer & merchant agents converse with deadline-aware urgency.</div>
            </div>

            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">04. CRYPTO</div>
              <div className="text-ink-100 font-semibold">HMAC Signing</div>
              <div className="text-[11px] text-ink-400 font-sans">Seals canonical JSON terms with single-use anti-replay nonces.</div>
            </div>

            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">05. CONCURRENCY</div>
              <div className="text-ink-100 font-semibold">Atomic Reserve</div>
              <div className="text-[11px] text-ink-400 font-sans">Conditional SQL update prevents race conditions and overselling.</div>
            </div>

            <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
              <div className="text-signal font-bold">06. SETTLE</div>
              <div className="text-ink-100 font-semibold">Razorpay Capture</div>
              <div className="text-[11px] text-ink-400 font-sans">Links 1:1 order, verifies webhook HMAC, and writes to audit log.</div>
            </div>
          </div>
        </section>
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-ink-800 bg-ink-900 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-ink-400">
          <div>
            <span>Razorpay DealFlow</span> • Sovereign Deal Desk for Agentic Commerce
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-ink-200 text-signal-light">Overview</Link>
            <Link href="/merchant-console" className="hover:text-ink-200">Merchant Console</Link>
            <Link href="/deal-room" className="hover:text-ink-200">Deal Room</Link>
            <Link href="/auction" className="hover:text-ink-200">Auction</Link>
            <Link href="/audit" className="hover:text-ink-200">Audit Ledger</Link>
            <Link href="/scenarios" className="hover:text-ink-200">Scenarios</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
