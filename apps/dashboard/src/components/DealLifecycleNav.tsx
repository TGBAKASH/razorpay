'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '../lib/config';

export type LifecycleStage =
  | 'REQUEST_RECEIVED'
  | 'OFFER_GENERATED'
  | 'POLICY_APPROVED'
  | 'OFFER_ACCEPTED'
  | 'ORDER_CREATED'
  | 'PAID';

interface DealLifecycleNavProps {
  currentStage?: LifecycleStage;
}

export function DealLifecycleNav({ currentStage }: DealLifecycleNavProps) {
  const pathname = usePathname();
  const currentPath = pathname || '/';
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // The 5 Canonical Real Product Routes
  const mainRoutes = [
    { label: '01 Overview', href: '/' },
    { label: '02 Merchant Console', href: '/merchant-console' },
    { label: '03 Deal Room', href: '/deal-room' },
    { label: '04 Contract & Checkout', href: '/checkout' },
    { label: '05 Audit Ledger', href: '/audit' },
  ];

  // The 6 Exact Deal Lifecycle States (Clean Human Names)
  const lifecycleStates: { id: LifecycleStage; number: string; label: string; href: string }[] = [
    {
      id: 'REQUEST_RECEIVED',
      number: '01',
      label: 'Request',
      href: '/deal-room',
    },
    {
      id: 'OFFER_GENERATED',
      number: '02',
      label: 'Offer made',
      href: '/deal-room',
    },
    {
      id: 'POLICY_APPROVED',
      number: '03',
      label: 'Approved',
      href: '/merchant-console',
    },
    {
      id: 'OFFER_ACCEPTED',
      number: '04',
      label: 'Accepted',
      href: '/checkout',
    },
    {
      id: 'ORDER_CREATED',
      number: '05',
      label: 'Order placed',
      href: '/checkout',
    },
    {
      id: 'PAID',
      number: '06',
      label: 'Paid',
      href: '/audit',
    },
  ];

  // Determine active stage from path
  const derivedStage: LifecycleStage =
    currentStage ||
    (currentPath === '/'
      ? 'REQUEST_RECEIVED'
      : currentPath.startsWith('/merchant-console') || currentPath.startsWith('/policy') || currentPath.startsWith('/catalog') || currentPath.startsWith('/approvals')
      ? 'POLICY_APPROVED'
      : currentPath.startsWith('/deal-room') || currentPath.startsWith('/simulator') || currentPath.startsWith('/auction')
      ? 'OFFER_GENERATED'
      : currentPath.startsWith('/checkout')
      ? 'ORDER_CREATED'
      : currentPath.startsWith('/audit')
      ? 'PAID'
      : 'OFFER_GENERATED');

  const handleResetDemoData = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await fetch(`${API_BASE_URL}/api/demo/reset`, { method: 'POST' }).catch(() => {});
      setResetMessage('Demo data reset.');
      setTimeout(() => {
        setResetMessage(null);
        window.location.reload();
      }, 700);
    } catch {
      setResetMessage('Demo data reset.');
      setTimeout(() => {
        setResetMessage(null);
        window.location.reload();
      }, 700);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="w-full bg-ink-900 border-b border-ink-700 select-none sticky top-0 z-40 shadow-md">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-ink-800 border border-ink-700 flex items-center justify-center font-display font-black text-signal text-base sm:text-lg shadow-sm group-hover:border-signal transition-colors">
            DF
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display font-bold text-ink-100 tracking-tight text-sm sm:text-base group-hover:text-signal-light transition-colors">
                Razorpay DealFlow
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono uppercase px-1.5 py-0.2 sm:py-0.5 rounded bg-signal-bg text-signal border border-signal-border font-bold">
                Live
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-sans text-ink-400 block -mt-0.5">
              The Sovereign Deal Desk for Agentic Commerce
            </span>
          </div>
        </Link>

        {/* Canonical 5 Routes + Reset Demo Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-full pb-0.5 sm:pb-0 scrollbar-none">
            {mainRoutes.map((route) => {
              const isActive =
                currentPath === route.href ||
                (route.href === '/merchant-console' &&
                  (currentPath.startsWith('/policy') || currentPath.startsWith('/catalog') || currentPath.startsWith('/approvals'))) ||
                (route.href === '/deal-room' &&
                  (currentPath.startsWith('/simulator') || currentPath.startsWith('/auction')));

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`text-xs font-mono font-medium px-2.5 sm:px-3 py-1 sm:py-1.5 rounded whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                    isActive
                      ? 'bg-ink-800 text-ink-100 border border-ink-600 font-bold shadow-sm'
                      : 'text-ink-400 hover:text-ink-200 hover:bg-ink-850'
                  }`}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleResetDemoData}
            disabled={isResetting}
            title="Reset demo data to start fresh for a new take"
            className="text-[11px] font-mono py-1 px-2.5 bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-ink-200 border border-ink-800 hover:border-ink-600 rounded transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none disabled:opacity-50"
          >
            <span>{isResetting ? '⏳' : '↺'}</span>
            <span>{resetMessage || 'Reset Demo'}</span>
          </button>
        </div>
      </div>

      {/* The Persistent 6-Stage Deal Lifecycle Stepper */}
      <div className="bg-ink-950 border-t border-ink-800 overflow-x-auto scrollbar-none py-1 sm:py-1.5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between min-w-[720px] sm:min-w-[800px]">
          <span className="text-[9px] sm:text-[10px] font-mono text-ink-500 uppercase tracking-wider shrink-0 mr-2 sm:mr-3">
            DEAL LIFECYCLE:
          </span>

          <div className="flex items-center justify-between flex-1 gap-1">
            {lifecycleStates.map((state, idx) => {
              const isCurrent = derivedStage === state.id;

              return (
                <React.Fragment key={state.id}>
                  <Link
                    href={state.href}
                    className={`flex items-center gap-1 sm:gap-1.5 py-0.5 sm:py-1 px-1.5 sm:px-2 rounded transition-colors group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                      isCurrent
                        ? 'bg-signal-bg border border-signal-border text-signal-light'
                        : 'text-ink-500 hover:text-ink-300 hover:bg-ink-900'
                    }`}
                  >
                    <span
                      className={`font-mono text-[9px] font-bold px-1 py-0.2 rounded transition-colors ${
                        isCurrent
                          ? 'bg-signal text-white'
                          : 'bg-ink-800 text-ink-500 group-hover:text-ink-400'
                      }`}
                    >
                      {state.number}
                    </span>
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold tracking-tight">
                      {state.label}
                    </span>
                  </Link>

                  {idx < lifecycleStates.length - 1 && (
                    <span className="text-ink-800 font-mono text-[10px] select-none">
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
