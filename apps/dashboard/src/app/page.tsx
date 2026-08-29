import Link from 'next/link';
import { DealLifecycleNav } from '../components/DealLifecycleNav';

export default function Home() {
  const lifecycleFlow = [
    {
      step: '01',
      state: 'Request',
      role: 'Buyer intent',
      desc: 'Buyer agent sends intent with budget ceiling, quantity, delivery deadline, and payment rail.',
    },
    {
      step: '02',
      state: 'Offer made',
      role: 'Pricing engine',
      desc: 'Merchant engine scores candidate deals against margin floor, inventory velocity, and logistics SLA.',
    },
    {
      step: '03',
      state: 'Approved',
      role: 'Signed contract',
      desc: 'Winning offer is locked into an HMAC-SHA256 contract ticket with a single-use nonce.',
    },
    {
      step: '04',
      state: 'Accepted',
      role: 'Buyer handshake',
      desc: 'Buyer accepts the signed contract. Security checks verify price has not been tampered with.',
    },
    {
      step: '05',
      state: 'Order placed',
      role: 'Razorpay order',
      desc: 'Razorpay order created with exact paise amount locked 1:1 to the signed contract.',
    },
    {
      step: '06',
      state: 'Paid',
      role: 'Audit ledger',
      desc: 'Raw webhook HMAC verified, funds captured, and state permanently recorded in the audit ledger.',
    },
  ];

  const primaryViews = [
    {
      title: '02 Merchant Console',
      href: '/merchant-console',
      badge: 'GOVERNANCE',
      desc: 'Configure discount ceilings, minimum profit floors, upload catalog CSVs, and approve high-value orders.',
    },
    {
      title: '03 Live Deal Room',
      href: '/deal-room',
      badge: 'CENTERPIECE',
      desc: 'Watch an AI buyer and your merchant agent negotiate in real time (Single-Merchant & 3-Merchant Auction).',
    },
    {
      title: '04 Contract & Checkout',
      href: '/checkout',
      badge: 'SETTLEMENT',
      desc: 'Inspect the cryptographic contract ticket and complete settlement via Razorpay Checkout.js and webhooks.',
    },
    {
      title: '05 Audit Ledger',
      href: '/audit',
      badge: 'IMMUTABLE',
      desc: 'Searchable chronological timeline tracking every state transition, policy rule, actor, and gateway response.',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav currentStage="REQUEST_RECEIVED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-12">
        {/* Hero 30-Second Explainer Banner */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 sm:p-10 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-xs font-bold text-signal tracking-wider uppercase">
                OVERVIEW • 30-SECOND EXECUTIVE BRIEF
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-ink-400">
              <span>SETTLEMENT: <strong>RAZORPAY TESTNET</strong></span>
              <span>•</span>
              <span>MATH: <strong>INTEGER PAISE</strong></span>
              <span>•</span>
              <span>STATE: <strong>6 STRICT TRANSITIONS</strong></span>
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink-100 max-w-4xl leading-tight">
            The Negotiation Layer for Agentic Commerce
          </h1>

          <p className="text-base sm:text-lg text-ink-200 max-w-3xl mt-4 font-sans leading-relaxed">
            <strong>DealFlow</strong> is a merchant-side autonomous agent that negotiates bounded, personalized offers with buyer agents and settles them through Razorpay.
          </p>

          <p className="text-xs sm:text-sm text-ink-400 max-w-3xl mt-2 font-sans leading-relaxed">
            As AI buyer agents shop across the internet with strict deadlines and budgets, static catalog prices cause massive drop-offs. DealFlow bridges this gap by calculating personalized discounts in sub-second time, sealing them into HMAC-signed legal contracts, and executing instant payment capture.
          </p>

          {/* Dual Clear CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-ink-800">
            <Link
              href="/deal-room"
              className="py-3 px-6 bg-signal hover:bg-signal-light text-white font-sans text-sm font-bold rounded transition-colors shadow-lg flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
            >
              <span>03 Enter the Live Deal Room</span>
              <span className="font-mono">→</span>
            </Link>

            <Link
              href="/merchant-console"
              className="py-3 px-6 bg-ink-800 hover:bg-ink-750 text-ink-100 border border-ink-600 font-sans text-sm font-bold rounded transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
            >
              <span>02 Configure Merchant Rules</span>
              <span className="font-mono">→</span>
            </Link>

            <Link
              href="/checkout"
              className="py-3 px-5 text-ink-400 hover:text-ink-200 font-sans text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
            >
              04 Contract & Checkout →
            </Link>
          </div>
        </div>

        {/* The 6-Stage Deal Lifecycle Explainer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <div>
              <h2 className="font-display text-xl font-bold text-ink-100">
                How an Autonomous Deal Executes
              </h2>
              <p className="text-xs text-ink-400 mt-0.5 font-sans">
                Every transaction flows strictly through 6 immutable states with zero skipped stages or floating-point rounding.
              </p>
            </div>
            <span className="font-mono text-xs text-ink-500 uppercase">
              STATE MACHINE INVARIANTS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {lifecycleFlow.map((item) => (
              <div
                key={item.step}
                className="bg-ink-900 border border-ink-700 p-4 rounded-lg flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-1.5 py-0.2 rounded">
                      {item.step}
                    </span>
                    <span className="font-mono text-[9px] text-ink-500 uppercase">
                      {item.role}
                    </span>
                  </div>
                  <h3 className="font-mono text-xs font-bold text-ink-100 break-words">
                    {item.state}
                  </h3>
                  <p className="text-[11px] text-ink-400 mt-1.5 font-sans leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canonical Routes Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <div>
              <h2 className="font-display text-xl font-bold text-ink-100">
                Explore the Core Workspace Desks
              </h2>
              <p className="text-xs text-ink-400 mt-0.5 font-sans">
                Navigate directly to any phase of the platform. Every screen includes plain-English instructions and interactive controls.
              </p>
            </div>
            <span className="font-mono text-xs text-ink-500 uppercase">
              WORKSPACE VIEWS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {primaryViews.map((view) => (
              <Link
                key={view.href}
                href={view.href}
                className="bg-ink-900 border border-ink-700 hover:border-signal p-5 rounded-lg flex flex-col justify-between transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-ink-400 bg-ink-800 px-2 py-0.5 rounded border border-ink-700">
                      {view.badge}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-100 group-hover:text-signal-light transition-colors">
                    {view.title}
                  </h3>
                  <p className="text-xs text-ink-400 mt-1.5 font-sans leading-relaxed">
                    {view.desc}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-ink-800 flex items-center justify-end text-xs font-mono text-signal group-hover:translate-x-0.5 transition-transform">
                  Open View →
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
            <span>RAZORPAY DEALFLOW PROTOCOL</span>
            <span>•</span>
            <span>IMMUTABLE HMAC CONTRACTS</span>
            <span>•</span>
            <span>PAISE ARITHMETIC</span>
          </div>
          <div>READY FOR PRODUCTION TESTING</div>
        </div>
      </footer>
    </div>
  );
}
