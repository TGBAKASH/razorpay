import Link from 'next/link';

export default function Home() {
  const screens = [
    {
      href: '/simulator',
      icon: '🤖',
      title: 'Buyer Simulator',
      desc: 'Pick constraints or enter natural language queries. Parsed by Gemini & verified against CCO Zod schemas.',
    },
    {
      href: '/auction',
      icon: '⚡',
      title: 'Multi-Merchant Auction',
      desc: 'Parallel fan-out broadcast to Merchants A, B, and C with Multi-Attribute Decision scoring (Speed vs. Price vs. Extras).',
    },
    {
      href: '/scenarios',
      icon: '🧪',
      title: 'Demo Controls & Invariants',
      desc: 'Trigger all 8 failure modes live: concurrency race, price tampering, payment retries, mandate checks, and LLM isolation.',
    },
    {
      href: '/checkout',
      icon: '💳',
      title: 'Checkout & Settlement',
      desc: 'Checkout.js test mode integration, HMAC webhook signature verification, amount cross-checks, and dispute refunds.',
    },
    {
      href: '/audit',
      icon: '📜',
      title: 'Audit Timeline',
      desc: 'Searchable chronological timeline tracking state transitions, initiator actors, policy versions, rules, and raw Razorpay I/O.',
    },
    {
      href: '/catalog',
      icon: '📦',
      title: 'Catalog & CSV Importer',
      desc: 'Upload catalog CSVs with Zod validation, automated negative margin rejection, and SKU velocity tracking.',
    },
    {
      href: '/policy',
      icon: '🛡️',
      title: 'Policy Configuration',
      desc: 'Immutable policy versioning (v1 → v2). Configure margin floors, discount ceilings, and approval thresholds.',
    },
    {
      href: '/live-feed',
      icon: '📡',
      title: 'Live Negotiation Feed',
      desc: 'Real-time stream of incoming buyer agent requests, multi-candidate scoring, and autonomous decisions.',
    },
    {
      href: '/approvals',
      icon: '👤',
      title: 'Human Approval Queue',
      desc: 'Review high-value orders (held in APPROVAL_PENDING) with named human approver audit accountability.',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-6xl w-full text-center space-y-8 my-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-mono font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            DealFlow Autonomous Agent Negotiation Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Razorpay Autonomous DealFlow
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto">
            Zero-human autonomous negotiation protocol with deterministic policy enforcement, cryptographic HMAC-signed contracts, multi-merchant auction broadcast, and Razorpay test mode settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
          {screens.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition hover:bg-slate-850 space-y-2 group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="text-2xl">{screen.icon}</div>
                <h3 className="font-semibold text-white group-hover:text-cyan-400 transition text-sm">
                  {screen.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {screen.desc}
                </p>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono font-semibold pt-2">
                Open Screen &rarr;
              </span>
            </Link>
          ))}
        </div>

        <div className="border-t border-slate-900 pt-6 text-xs text-slate-500 font-mono">
          Strict Invariants Enforced: Deterministic Pricing • Signed Contracts • Paise Math • Zero-Jump State Machine • Test Mode Only
        </div>
      </div>
    </main>
  );
}
