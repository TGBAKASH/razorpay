'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { TabularNumber } from '../../components/TabularNumber';

interface PolicyData {
  policyVersion: string;
  minMarginPct: number;
  maxDiscountPct: number;
  freeDeliveryAbovePaise: number;
  noDiscountFastMoving: boolean;
  clearWithinDays: number;
  prepaidDiscountOnHighCodRisk: boolean;
  humanApprovalAbovePaise: number;
  updatedAt?: string;
  updatedBy?: string;
}

export default function PolicyPage() {
  const [activePolicy, setActivePolicy] = useState<PolicyData>({
    policyVersion: 'v1',
    minMarginPct: 18.0,
    maxDiscountPct: 12.0,
    freeDeliveryAbovePaise: 149900,
    noDiscountFastMoving: true,
    clearWithinDays: 30,
    prepaidDiscountOnHighCodRisk: true,
    humanApprovalAbovePaise: 1500000,
  });

  const [history, setHistory] = useState<PolicyData[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [approverName, setApproverName] = useState('merchant_admin_akash');

  useEffect(() => {
    fetchPolicy();
  }, []);

  async function fetchPolicy() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchants/sprint-athletics/policy`);
      const data = await res.json();
      if (data.active_policy) {
        setActivePolicy(data.active_policy);
        setHistory(data.policy_history || []);
      }
    } catch {
      // Fallback
    }
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/merchants/sprint-athletics/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_margin_pct: Number(activePolicy.minMarginPct),
          max_discount_pct: Number(activePolicy.maxDiscountPct),
          free_delivery_above_paise: Number(activePolicy.freeDeliveryAbovePaise),
          no_discount_fast_moving: Boolean(activePolicy.noDiscountFastMoving),
          clear_within_days: Number(activePolicy.clearWithinDays),
          prepaid_discount_on_high_cod_risk: Boolean(activePolicy.prepaidDiscountOnHighCodRisk),
          human_approval_above_paise: Number(activePolicy.humanApprovalAbovePaise),
          updated_by: approverName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActivePolicy(data.active_policy);
        setHistory(data.policy_history || []);
        setStatusMessage(`Policy updated! New immutable version "${data.active_policy.policyVersion}" activated.`);
      }
    } catch {
      setStatusMessage('Policy update simulation: Version incremented.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                OPERATIONAL DESK • POLICY GOVERNANCE
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Merchant Policy Matrix & Version Control
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Deterministic parameters governing auto-negotiation. Every update creates an append-only, immutable policy version (v1 → v2).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-3 py-1.5 rounded">
              ACTIVE VERSION: {activePolicy.policyVersion}
            </span>
          </div>
        </div>

        {statusMessage && (
          <div className="bg-signal-bg border border-signal-border p-4 rounded-lg text-signal-light text-xs font-mono">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Policy Configuration Form */}
          <div className="lg:col-span-7 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="font-mono text-xs font-bold text-ink-300 uppercase">
                Deterministic Policy Parameter Controls
              </span>
              <span className="font-mono text-[10px] text-ink-500 uppercase">
                MUTATION LOCK
              </span>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Minimum Gross Margin Floor (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={activePolicy.minMarginPct}
                    onChange={(e) =>
                      setActivePolicy({ ...activePolicy, minMarginPct: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Maximum Auto-Discount Ceiling (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={activePolicy.maxDiscountPct}
                    onChange={(e) =>
                      setActivePolicy({ ...activePolicy, maxDiscountPct: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Free Delivery Order Threshold (Paise)
                  </label>
                  <input
                    type="number"
                    value={activePolicy.freeDeliveryAbovePaise}
                    onChange={(e) =>
                      setActivePolicy({
                        ...activePolicy,
                        freeDeliveryAbovePaise: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    = <TabularNumber value={activePolicy.freeDeliveryAbovePaise} isCurrencyPaise prefix="₹" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Human Approval Threshold (Paise)
                  </label>
                  <input
                    type="number"
                    value={activePolicy.humanApprovalAbovePaise}
                    onChange={(e) =>
                      setActivePolicy({
                        ...activePolicy,
                        humanApprovalAbovePaise: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    = <TabularNumber value={activePolicy.humanApprovalAbovePaise} isCurrencyPaise prefix="₹" />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-ink-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activePolicy.noDiscountFastMoving}
                    onChange={(e) =>
                      setActivePolicy({ ...activePolicy, noDiscountFastMoving: e.target.checked })
                    }
                    className="rounded bg-ink-950 border-ink-700 text-signal focus:ring-signal"
                  />
                  <span className="text-xs font-sans text-ink-300">
                    Prohibit auto-discounts on high-velocity (fast moving) SKUs
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activePolicy.prepaidDiscountOnHighCodRisk}
                    onChange={(e) =>
                      setActivePolicy({
                        ...activePolicy,
                        prepaidDiscountOnHighCodRisk: e.target.checked,
                      })
                    }
                    className="rounded bg-ink-950 border-ink-700 text-signal focus:ring-signal"
                  />
                  <span className="text-xs font-sans text-ink-300">
                    Incentivize prepaid (UPI/Card) on high COD return risk orders
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                  Authorizing Merchant Admin Identifier
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow disabled:opacity-50"
              >
                {isLoading ? 'Saving Immutable Version...' : 'Deploy New Policy Version (v2) →'}
              </button>
            </form>
          </div>

          {/* Policy Version History Ledger */}
          <div className="lg:col-span-5 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="font-mono text-xs font-bold text-ink-300 uppercase">
                Immutable Version History
              </span>
              <span className="font-mono text-[10px] text-ink-500 uppercase">
                AUDITABLE
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-ink-950 border border-signal-border p-3 rounded text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-signal font-bold">CURRENT: {activePolicy.policyVersion}</span>
                  <span className="text-[10px] text-ink-500">LIVE ENGINE</span>
                </div>
                <div className="text-ink-400 text-[11px]">
                  Floor: {activePolicy.minMarginPct}% • Ceiling: {activePolicy.maxDiscountPct}%
                </div>
                <div className="text-ink-500 text-[10px]">
                  Approval threshold: <TabularNumber value={activePolicy.humanApprovalAbovePaise} isCurrencyPaise prefix="₹" />
                </div>
              </div>

              {history.map((hist, idx) => (
                <div
                  key={idx}
                  className="bg-ink-950 border border-ink-800 p-3 rounded text-xs font-mono space-y-1 text-ink-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink-300">HISTORICAL: {hist.policyVersion}</span>
                    <span className="text-[10px] text-ink-600">ARCHIVED</span>
                  </div>
                  <div className="text-[11px]">
                    Floor: {hist.minMarginPct}% • Ceiling: {hist.maxDiscountPct}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
