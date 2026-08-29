'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '../lib/config';

export function DealLifecycleNav(_props?: { currentStage?: string }) {
  const pathname = usePathname();
  const currentPath = pathname || '/';
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // The 4 Canonical Primary Navigation Items
  const mainRoutes = [
    { label: '01 Overview', href: '/' },
    { label: '02 Merchant Console', href: '/merchant-console' },
    { label: '03 Deal Room', href: '/deal-room' },
    { label: '04 Audit Ledger', href: '/audit' },
  ];

  const handleResetDemoData = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await fetch(`${API_BASE_URL}/api/demo/reset`, { method: 'POST' }).catch(() => {});
      setResetMessage('Reset');
      setTimeout(() => {
        setResetMessage(null);
        window.location.reload();
      }, 600);
    } catch {
      setResetMessage('Reset');
      setTimeout(() => {
        setResetMessage(null);
        window.location.reload();
      }, 600);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="w-full bg-ink-900 border-b border-ink-700 select-none sticky top-0 z-40 shadow-sm">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded"
        >
          <div className="w-8 h-8 rounded bg-ink-800 border border-ink-700 flex items-center justify-center font-display font-black text-signal text-lg shadow-sm group-hover:border-signal transition-colors">
            DF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-ink-100 tracking-tight text-base group-hover:text-signal-light transition-colors">
                Razorpay DealFlow
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-signal-bg text-signal border border-signal-border font-bold">
                Live
              </span>
            </div>
            <span className="text-[11px] font-sans text-ink-400 block -mt-0.5 hidden sm:block">
              The Sovereign Deal Desk for Agentic Commerce
            </span>
          </div>
        </Link>

        {/* 4 Canonical Routes + Corner Utility Reset */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none">
            {mainRoutes.map((route) => {
              const isActive =
                currentPath === route.href ||
                (route.href === '/merchant-console' &&
                  (currentPath.startsWith('/policy') ||
                    currentPath.startsWith('/catalog') ||
                    currentPath.startsWith('/approvals'))) ||
                (route.href === '/deal-room' &&
                  (currentPath.startsWith('/simulator') ||
                    currentPath.startsWith('/auction') ||
                    currentPath.startsWith('/checkout')));

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`text-xs font-mono font-medium px-3 py-1.5 rounded whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
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

          {/* Small corner icon-only Reset Demo control */}
          <button
            onClick={handleResetDemoData}
            disabled={isResetting}
            title="Reset demo data to start fresh for a new recording take"
            aria-label="Reset demo data"
            className="w-7 h-7 flex items-center justify-center text-xs font-mono bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-ink-200 border border-ink-800 hover:border-ink-600 rounded transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none disabled:opacity-50"
          >
            <span className={isResetting ? 'animate-spin' : ''}>↺</span>
          </button>
        </div>
      </div>
    </header>
  );
}
