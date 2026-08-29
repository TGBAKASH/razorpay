'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DealLifecycleNavProps {
  currentStage?: 'REQUEST' | 'OFFER' | 'CONTRACT' | 'PAYMENT' | 'AUDIT';
}

export function DealLifecycleNav({ currentStage }: DealLifecycleNavProps) {
  const pathname = usePathname();

  const lifecycleStages = [
    {
      id: 'REQUEST',
      number: '01',
      label: 'Intent / Request',
      href: '/simulator',
      activePaths: ['/simulator'],
    },
    {
      id: 'OFFER',
      number: '02',
      label: 'Auction / Policy',
      href: '/auction',
      activePaths: ['/auction'],
    },
    {
      id: 'CONTRACT',
      number: '03',
      label: 'Signed Contract',
      href: '/scenarios',
      activePaths: ['/scenarios'],
    },
    {
      id: 'PAYMENT',
      number: '04',
      label: 'Razorpay Settlement',
      href: '/checkout',
      activePaths: ['/checkout'],
    },
    {
      id: 'AUDIT',
      number: '05',
      label: 'Audit Log & State',
      href: '/audit',
      activePaths: ['/audit'],
    },
  ];

  const operationalTools = [
    { label: 'Catalog Ledger', href: '/catalog' },
    { label: 'Policy Matrix', href: '/policy' },
    { label: 'Approvals Queue', href: '/approvals' },
    { label: 'Live Deal Ticker', href: '/live-feed' },
    { label: 'Demo Controls', href: '/scenarios' },
  ];

  return (
    <header className="w-full bg-ink-900 border-b border-ink-700 select-none">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Protocol Tag */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded bg-ink-800 border border-ink-700 flex items-center justify-center font-display font-black text-signal text-lg shadow-sm group-hover:border-signal transition-colors">
            DF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-ink-100 tracking-tight text-base group-hover:text-signal-light transition-colors">
                Razorpay DealFlow
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-signal-bg text-signal border border-signal-border">
                Protocol v1.0
              </span>
            </div>
            <span className="text-[11px] font-sans text-ink-400 block -mt-0.5">
              The Sovereign Deal Desk for Agentic Commerce
            </span>
          </div>
        </Link>

        {/* Operational Tools Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {operationalTools.map((tool) => {
            const isActive = pathname === tool.href;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-ink-800 text-ink-100 border border-ink-600'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-850'
                }`}
              >
                {tool.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Primary Deal Lifecycle Spine */}
      <div className="bg-ink-950 border-t border-ink-800 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between min-w-[700px]">
          {lifecycleStages.map((stage, idx) => {
            const isCurrent =
              currentStage === stage.id ||
              stage.activePaths.some((p) => pathname?.startsWith(p));

            return (
              <React.Fragment key={stage.id}>
                <Link
                  href={stage.href}
                  className={`flex items-center gap-2.5 py-2.5 px-3 border-b-2 transition-all group ${
                    isCurrent
                      ? 'border-signal text-ink-100 bg-ink-900/60'
                      : 'border-transparent text-ink-400 hover:text-ink-300 hover:border-ink-700'
                  }`}
                >
                  <span
                    className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? 'bg-signal text-white'
                        : 'bg-ink-800 text-ink-500 group-hover:text-ink-400'
                    }`}
                  >
                    {stage.number}
                  </span>
                  <span className="text-xs font-medium tracking-wide">
                    {stage.label}
                  </span>
                </Link>

                {idx < lifecycleStages.length - 1 && (
                  <div className="text-ink-700 font-mono text-xs select-none">
                    ──→
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </header>
  );
}
