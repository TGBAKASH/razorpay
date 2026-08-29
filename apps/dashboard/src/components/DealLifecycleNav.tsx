'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '../lib/config';
import { useAuth, UserRole } from './AuthContext';

export function DealLifecycleNav(_props?: { currentStage?: string }) {
  let currentPath = '/';
  try {
    currentPath = usePathname() || '/';
  } catch {}

  const { user, login } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tempEmail, setTempEmail] = useState(user?.email || 'akash@dealflow.ai');
  const [tempRole, setTempRole] = useState<UserRole>(user?.role || 'buyer');

  const isMerchant = user?.role === 'merchant';

  // Role-Specific Navigation Links
  const mainRoutes = isMerchant
    ? [
        { label: '01 Merchant Console', href: '/merchant-console' },
        { label: '02 Audit Ledger', href: '/audit' },
      ]
    : [
        { label: '01 Deal Room', href: '/deal-room' },
        { label: '02 My Orders', href: '/orders' },
      ];

  const handleResetDemoData = async () => {
    setIsResetting(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await fetch(`${API_BASE_URL}/api/demo/reset`, { method: 'POST' }).catch(() => {});
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload();
      }, 600);
    } catch {
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload();
      }, 600);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = tempEmail.trim() || 'user@dealflow.ai';
    login(cleanEmail, tempRole);
    setShowAuthModal(false);
    // Route immediately to the role's home view
    if (typeof window !== 'undefined') {
      window.location.href = tempRole === 'merchant' ? '/merchant-console' : '/deal-room';
    }
  };

  const roleHomeHref = isMerchant ? '/merchant-console' : '/deal-room';

  return (
    <header className="w-full bg-ink-900 border-b border-ink-700 select-none sticky top-0 z-40 shadow-sm">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Link to Role Home */}
        <Link
          href={roleHomeHref}
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
                {isMerchant ? 'Merchant Portal' : 'Buyer Agent'}
              </span>
            </div>
            <span className="text-[11px] font-sans text-ink-400 block -mt-0.5 hidden sm:block">
              The Sovereign Deal Desk for Agentic Commerce
            </span>
          </div>
        </Link>

        {/* Role-Specific Nav Links */}
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

        {/* Right Section: User Role Pill & Corner Reset */}
        <div className="flex items-center gap-2.5">
          {/* User Session Pill */}
          <button
            onClick={() => {
              setTempEmail(user?.email || 'akash@dealflow.ai');
              setTempRole(user?.role || 'buyer');
              setShowAuthModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-ink-950 hover:bg-ink-850 border border-ink-700 hover:border-ink-600 rounded text-xs font-mono transition-colors focus-visible:ring-1 focus-visible:ring-signal"
            title="Click to switch role or edit session"
          >
            <span className="w-2 h-2 rounded-full bg-signal" />
            <span className="text-ink-300 max-w-[120px] truncate hidden md:inline">{user?.email}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                user?.role === 'merchant'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                  : 'bg-signal-bg text-signal-light border border-signal-border'
              }`}
            >
              {user?.role === 'merchant' ? 'Merchant' : 'Buyer'}
            </span>
            <span className="text-ink-500 text-[10px]">▼</span>
          </button>

          {/* Icon-only Reset Demo Control */}
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

      {/* Lightweight Role / Session Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-3">
              <h3 className="text-sm font-bold text-ink-100 font-display">
                Session & Role Settings
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-ink-400 hover:text-ink-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  required
                  placeholder="agent@company.com"
                  className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                  Active Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempRole('buyer')}
                    className={`py-2 px-3 rounded text-xs font-mono font-medium transition-colors border ${
                      tempRole === 'buyer'
                        ? 'bg-signal text-white border-signal font-bold shadow'
                        : 'bg-ink-950 text-ink-400 border-ink-700 hover:text-ink-200'
                    }`}
                  >
                    Buyer Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempRole('merchant')}
                    className={`py-2 px-3 rounded text-xs font-mono font-medium transition-colors border ${
                      tempRole === 'merchant'
                        ? 'bg-amber-600 text-white border-amber-500 font-bold shadow'
                        : 'bg-ink-950 text-ink-400 border-ink-700 hover:text-ink-200'
                    }`}
                  >
                    Merchant
                  </button>
                </div>
                <p className="text-[11px] text-ink-500 mt-1">
                  {tempRole === 'buyer'
                    ? 'Buyer role: Deal Room and My Orders with zero merchant-confidential margins.'
                    : 'Merchant role: Merchant Console and full Audit Ledger with policy and margin detail.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-800">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-3 py-1.5 bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-ink-200 text-xs font-mono rounded border border-ink-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow"
                >
                  Save & Switch View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
