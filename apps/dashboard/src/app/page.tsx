import Link from 'next/link';
import { DealLifecycleNav } from '../components/DealLifecycleNav';
import { TabularNumber } from '../components/TabularNumber';

export default function Home() {
  const lifecycleCards = [
    {
      step: '01',
      title: 'Intent & Adapt',
      tag: 'REQUEST',
      href: '/simulator',
      desc: 'Buyer constraint parser & protocol adapter (ACP, UCP, AP2, UAP). Gemini natural language parsing into Common Commerce Object (CCO).',
      status: 'ACTIVE',
    },
    {
      step: '02',
      title: 'Auction & Policy',
      tag: 'OFFER',
      href: '/auction',
      desc: 'Parallel fan-out broadcast to 3 merchant engines. Multi-attribute utility ranking weighting delivery speed, price, and customization.',
      status: 'PARALLEL',
    },
    {
      step: '03',
      title: 'Signed Contract',
      tag: 'CONTRACT',
      href: '/scenarios',
      desc: 'Deterministic policy evaluation, HMAC-SHA256 contract signing, nonce single-use lock, and 8 failure-mode invariant guards.',
      status: 'DETERMINISTIC',
    },
    {
      step: '04',
      title: 'Razorpay Checkout',
      tag: 'PAYMENT',
      href: '/checkout',
      desc: 'Checkout.js test mode settlement, webhook raw-body HMAC signature verification, zero-jump state transition, and dispute refunds.',
      status: 'SETTLED',
    },
    {
      step: '05',
      title: 'Audit Log & State',
      tag: 'AUDIT',
      href: '/audit',
      desc: 'Append-only cryptographic timeline. Complete audit trail tracing state transitions, policy versions, rules evaluated, and raw API I/O.',
      status: 'IMMUTABLE',
    },
  ];

  const operationalDesks = [
    {
      title: 'Merchant Catalog Desk',
      href: '/catalog',
      desc: 'SKU velocity monitoring, cost vs list price ratios, and CSV batch catalog import with negative margin rejection.',
      code: 'CATALOG_LEDGER',
    },
    {
      title: 'Policy Version Matrix',
      href: '/policy',
      desc: 'Immutable policy configuration (v1 → v2). Set margin floors, discount ceilings, and high-value approval thresholds.',
      code: 'POLICY_GOVERNANCE',
    },
    {
      title: 'Human Approvals Queue',
      href: '/approvals',
      desc: 'Authorize held orders exceeding auto-negotiation thresholds with named approver audit accountability.',
      code: 'HUMAN_IN_THE_LOOP',
    },
    {
      title: 'Live Negotiation Feed',
      href: '/live-feed',
      desc: 'Real-time telemetry stream of incoming buyer agent requests, multi-candidate scoring, and autonomous decisions.',
      code: 'TELEMETRY_STREAM',
    },
    {
      title: 'Demo Failure Scenarios',
      href: '/scenarios',
      desc: 'Trigger all 8 failure scenarios live: inventory race, price tampering, payment retries, mandate checks, and LLM isolation.',
      code: 'INVARIANT_TESTBED',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-12">
        {/* Terminal Header */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 sm:p-8 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-xs font-bold text-signal tracking-wider uppercase">
                DEALFLOW NEGOTIATION DESK • PRODUCTION READY
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-ink-400">
              <span>
                INTEG: <strong className="text-ink-200">RAZORPAY TESTNET</strong>
              </span>
              <span>•</span>
              <span>
                MATH: <strong className="text-ink-200">EXACT PAISE (INTEGER)</strong>
              </span>
              <span>•</span>
              <span>
                AUTH: <strong className="text-ink-200">HMAC-SHA256</strong>
              </span>
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink-100 max-w-3xl leading-tight">
            Autonomous Agent Negotiation & Settlement Protocol
          </h1>

          <p className="text-sm sm:text-base text-ink-300 max-w-3xl mt-3 font-sans leading-relaxed">
            Zero-human bilateral deal negotiation for AI agents. Bridges buyer intents, merchant deterministic policies, HMAC-signed legal contracts, and instant Razorpay payment settlement.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-ink-800">
            <Link
              href="/simulator"
              className="py-2 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors"
            >
              Launch Single-Merchant Flow →
            </Link>
            <Link
              href="/auction"
              className="py-2 px-4 bg-ink-800 hover:bg-ink-750 text-ink-100 border border-ink-600 font-sans text-xs font-semibold rounded transition-colors"
            >
              Launch 3-Merchant Auction →
            </Link>
            <Link
              href="/scenarios"
              className="py-2 px-4 bg-ink-850 hover:bg-ink-800 text-ink-300 border border-ink-700 font-sans text-xs font-semibold rounded transition-colors"
            >
              Trigger Failure Scenarios →
            </Link>
          </div>
        </div>

        {/* The 5 Deal Lifecycle Stations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <h2 className="font-display text-xl font-bold text-ink-100">
              The 5-Stage Deal Lifecycle
            </h2>
            <span className="font-mono text-xs text-ink-500 uppercase">
              DEAL FLOW SEQUENCE 01 THROUGH 05
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {lifecycleCards.map((card) => (
              <Link
                key={card.step}
                href={card.href}
                className="bg-ink-900 border border-ink-700 hover:border-signal p-4 rounded-lg flex flex-col justify-between transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-1.5 py-0.5 rounded">
                      PHASE {card.step}
                    </span>
                    <span className="font-mono text-[10px] text-ink-500 uppercase">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-100 group-hover:text-signal-light transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-ink-400 mt-2 font-sans leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-ink-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-ink-500">[{card.status}]</span>
                  <span className="text-signal group-hover:translate-x-0.5 transition-transform">
                    Enter →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Operational & Control Desks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <h2 className="font-display text-xl font-bold text-ink-100">
              Merchant Back-Office & Invariant Desks
            </h2>
            <span className="font-mono text-xs text-ink-500 uppercase">
              GOVERNANCE & TELEMETRY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operationalDesks.map((desk) => (
              <Link
                key={desk.code}
                href={desk.href}
                className="bg-ink-900 border border-ink-700 hover:border-ink-500 p-5 rounded-lg flex flex-col justify-between transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-ink-400 bg-ink-800 px-2 py-0.5 rounded border border-ink-700">
                      {desk.code}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-100 group-hover:text-ink-100">
                    {desk.title}
                  </h3>
                  <p className="text-xs text-ink-400 mt-1.5 font-sans leading-relaxed">
                    {desk.desc}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-ink-800 flex items-center justify-end text-[11px] font-mono text-ink-400 group-hover:text-ink-200">
                  Open Desk →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Structured Ledger Footer */}
      <footer className="border-t border-ink-800 bg-ink-950 py-4 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-ink-500">
          <div className="flex items-center gap-4">
            <span>RAZORPAY DEALFLOW</span>
            <span>•</span>
            <span>ZERO FLOATING POINT ROUNDING</span>
            <span>•</span>
            <span>STATE MACHINE: 7 STRICT STATES</span>
          </div>
          <div>PRODUCTION READY & MULTI-TENANT</div>
        </div>
      </footer>
    </div>
  );
}
