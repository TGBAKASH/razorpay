'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

interface AuditLogEntry {
  id: string;
  offer_id: string;
  from_state: string | null;
  to_state: string;
  action: string;
  actor: string;
  input_data: Record<string, any>;
  policy_version: string;
  policy_checked: string;
  reason: string;
  razorpay_request?: any | null;
  razorpay_response?: any | null;
  timestamp: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterOfferId, setFilterOfferId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const url = filterOfferId
        ? `${API_BASE_URL}/api/audit-logs?offer_id=${encodeURIComponent(filterOfferId)}`
        : `${API_BASE_URL}/api/audit-logs`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch {
      if (logs.length === 0) {
        setLogs(getMockSprintProAuditTrail());
      }
    }
  }

  function getMockSprintProAuditTrail(): AuditLogEntry[] {
    const offerId = 'offer-sprintpro-audit-001';
    return [
      {
        id: 'log-001',
        offer_id: offerId,
        from_state: null,
        to_state: 'OFFER_CREATED',
        action: 'EVALUATE_OFFER_CANDIDATES',
        actor: 'offer-engine-v1',
        input_data: { sku: 'SPRINTPRO-X2', qty: 1, budget_paise: 400000 },
        policy_version: 'v1.0.0',
        policy_checked: 'MIN_MARGIN, MAX_DISCOUNT, CARRIER_SLA',
        reason: 'Offer candidate approved within policy limits. Net price: ₹3,949.',
        timestamp: new Date(Date.now() - 40000).toISOString(),
      },
      {
        id: 'log-002',
        offer_id: offerId,
        from_state: 'OFFER_CREATED',
        to_state: 'ACCEPTED',
        action: 'ACCEPT_OFFER_CONTRACT',
        actor: 'buyer-agent-sim-01',
        input_data: { signature_verified: true, nonce: 'nonce_98f12a3d7b4' },
        policy_version: 'v1.0.0',
        policy_checked: 'SIGNATURE_INTEGRITY, NONCE_SINGLE_USE',
        reason: 'HMAC signature valid, nonce consumed and locked.',
        timestamp: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: 'log-003',
        offer_id: offerId,
        from_state: 'ACCEPTED',
        to_state: 'ORDER_CREATED',
        action: 'CREATE_RAZORPAY_ORDER',
        actor: 'dealflow-gateway',
        input_data: { razorpay_order_id: 'order_Nx8Y102948' },
        policy_version: 'v1.0.0',
        policy_checked: '1:1_CONTRACT_LOCK',
        reason: 'Razorpay order created with locked amount of ₹3,949 (394900 paise).',
        timestamp: new Date(Date.now() - 20000).toISOString(),
      },
      {
        id: 'log-004',
        offer_id: offerId,
        from_state: 'ORDER_CREATED',
        to_state: 'PAID',
        action: 'WEBHOOK_PAYMENT_CAPTURED',
        actor: 'razorpay-webhook-daemon',
        input_data: { razorpay_payment_id: 'pay_Px99214710', hmac_verified: true },
        policy_version: 'v1.0.0',
        policy_checked: 'WEBHOOK_SIGNATURE, AMOUNT_EXACT_MATCH',
        reason: 'Payment captured and reconciled. Deal lifecycle transitioned to PAID.',
        timestamp: new Date(Date.now() - 10000).toISOString(),
      },
    ];
  }

  const sampleTicket: DealTicketData = {
    offer_id: filterOfferId || 'offer-sprintpro-audit-001',
    sku: 'SPRINTPRO-X2',
    product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
    quantity: 1,
    final_price_paise: 394900,
    list_price_paise: 429900,
    discount_paise: 35000,
    discount_reasons: [
      'Prepaid payment incentive (UPI rail selected)',
      'High-velocity SKU clearance',
      'Monday delivery SLA guarantee',
    ],
    payment_methods_allowed: ['UPI', 'Card'],
    delivery_promise: '2026-08-31T23:59:59Z',
    return_terms_days: 10,
    merchant_id: 'merchant-sprint-alpha',
    merchant_name: 'SprintPro Footwear Ltd.',
    state: 'PAID',
    nonce: 'nonce_98f12a3d7b4',
    signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      log.offer_id.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.actor.toLowerCase().includes(q) ||
      log.to_state.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav currentStage="PAID" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip with Plain-English Explainer */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                VIEW 05 • CRYPTOGRAPHIC AUDIT LEDGER
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Immutable Deal Audit Ledger
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Inspect the append-only cryptographic timeline recording every state transition, policy check, actor, and gateway response.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-400 bg-ink-800 border border-ink-700 px-3 py-1.5 rounded">
              LEDGER: APPEND-ONLY
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-ink-900 border border-ink-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search by Offer ID, Action, Actor, or State..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs font-mono text-ink-100 placeholder-ink-600 focus:border-signal focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="py-1.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-300 border border-ink-700 text-xs font-mono rounded transition-colors"
            >
              ↻ Refresh Timeline
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stamped Deal Ticket in Audit Context */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <h3 className="font-display text-base font-bold text-ink-100">
                Audited Deal Ticket
              </h3>
              <span className="font-mono text-[10px] text-signal uppercase font-bold">
                RECONCILED PAID
              </span>
            </div>

            <DealTicket ticket={sampleTicket} />
          </div>

          {/* Right Column: Chronological State Transition Log */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <h3 className="font-display text-base font-bold text-ink-100">
                State Transition Timeline
              </h3>
              <span className="font-mono text-[10px] text-ink-500 uppercase">
                {filteredLogs.length} ENTRIES
              </span>
            </div>

            <div className="space-y-3">
              {filteredLogs.map((entry, index) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedLog(entry)}
                  className="bg-ink-900 border border-ink-700 hover:border-ink-500 rounded-lg p-4 space-y-2.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-ink-800 text-ink-400 px-2 py-0.5 rounded border border-ink-700">
                        #{index + 1}
                      </span>
                      <span className="font-mono text-xs font-bold text-signal">
                        {entry.action}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-ink-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-ink-400">{entry.from_state || 'START'}</span>
                    <span className="text-signal font-bold">──→</span>
                    <span className="bg-signal-bg text-signal border border-signal-border px-1.5 py-0.2 rounded font-bold">
                      {entry.to_state}
                    </span>
                    <span className="text-ink-600">•</span>
                    <span className="text-ink-400">Actor: {entry.actor}</span>
                    <span className="text-ink-600">•</span>
                    <span className="text-ink-500">Policy: {entry.policy_version}</span>
                  </div>

                  <p className="text-xs text-ink-300 font-sans leading-relaxed">
                    {entry.reason}
                  </p>

                  <div className="pt-1.5 border-t border-ink-800 flex items-center justify-between text-[10px] font-mono text-ink-500">
                    <span>Rules: {entry.policy_checked}</span>
                    <span className="text-ink-400 underline">Inspect Raw JSON →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inspect Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-ink-700 pb-3">
                <h3 className="font-display text-base font-bold text-ink-100">
                  Audit Entry: {selectedLog.action}
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="font-mono text-xs text-ink-400 hover:text-ink-100"
                >
                  [CLOSE ✕]
                </button>
              </div>

              <pre className="bg-ink-950 p-4 rounded text-xs font-mono text-ink-300 overflow-x-auto border border-ink-800">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
