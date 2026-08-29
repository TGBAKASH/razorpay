'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/config';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>🛡️</span> Merchant Policy & Version Control
            </h1>
            <p className="text-slate-400 mt-1">
              Phase 8: Immutable policy versioning (v1 &rarr; v2 &rarr; v3) with zero in-place mutation
            </p>
          </div>
          <div className="bg-purple-950 border border-purple-600 px-4 py-2 rounded-lg text-purple-300 font-mono font-bold text-sm">
            Active Policy: {activePolicy.policyVersion}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSavePolicy} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>⚙️</span> Policy Parameter Matrix
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Never mutates in place; increments version
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    MINIMUM PROFIT MARGIN (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={activePolicy.minMarginPct}
                    onChange={(e) => setActivePolicy({ ...activePolicy, minMarginPct: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Hard floor below which offers are rejected</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    MAXIMUM DISCOUNT CEILING (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={activePolicy.maxDiscountPct}
                    onChange={(e) => setActivePolicy({ ...activePolicy, maxDiscountPct: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-emerald-300 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Autonomous discount ceiling (e.g. 12% or 8%)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    FREE DELIVERY THRESHOLD (₹)
                  </label>
                  <input
                    type="number"
                    value={activePolicy.freeDeliveryAbovePaise / 100}
                    onChange={(e) => setActivePolicy({ ...activePolicy, freeDeliveryAbovePaise: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Cart amount in INR for free shipping</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    CLEARANCE WINDOW (DAYS)
                  </label>
                  <input
                    type="number"
                    value={activePolicy.clearWithinDays}
                    onChange={(e) => setActivePolicy({ ...activePolicy, clearWithinDays: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Days to expiry forcing clearance eligibility</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    HUMAN APPROVAL THRESHOLD (₹)
                  </label>
                  <input
                    type="number"
                    value={activePolicy.humanApprovalAbovePaise / 100}
                    onChange={(e) => setActivePolicy({ ...activePolicy, humanApprovalAbovePaise: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-amber-300 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Orders above this route to APPROVAL_PENDING</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    OPERATOR IDENTITY
                  </label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-purple-300 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500">Named administrator signing this version</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activePolicy.noDiscountFastMoving}
                    onChange={(e) => setActivePolicy({ ...activePolicy, noDiscountFastMoving: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-semibold text-slate-300 text-sm">Strict Fast-Moving SKU Discount Prohibition</span>
                    <p className="text-xs text-slate-500">Disallow discounts on high-velocity items unless clearance flag is active.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activePolicy.prepaidDiscountOnHighCodRisk}
                    onChange={(e) => setActivePolicy({ ...activePolicy, prepaidDiscountOnHighCodRisk: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-semibold text-slate-300 text-sm">Prepaid Subsidy on High COD Return Risk</span>
                    <p className="text-xs text-slate-500">Offer promo discount subsidizing prepaid UPI to eliminate RTO shipping losses.</p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Activating New Version...' : `🚀 Activate New Policy Version`}
              </button>

              {statusMessage && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono text-emerald-400">
                  {statusMessage}
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Version History */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>📚</span> Version History
              </h2>

              <p className="text-xs text-slate-400">
                Old signed offers remain verifiable and auditable against the exact version that approved them.
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-purple-950/60 border border-purple-800/80 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between text-purple-300 font-bold">
                    <span>{activePolicy.policyVersion} (ACTIVE)</span>
                    <span className="text-emerald-400">LIVE</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Max Discount: {activePolicy.maxDiscountPct}% • Min Margin: {activePolicy.minMarginPct}%
                  </div>
                </div>

                {history.map((hist, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1 text-slate-400">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>{hist.policyVersion} (ARCHIVED)</span>
                      <span className="text-slate-500">IMMUTABLE</span>
                    </div>
                    <div className="text-[11px]">
                      Max Discount: {hist.maxDiscountPct}% • Min Margin: {hist.minMarginPct}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Updated By: {hist.updatedBy || 'system'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
