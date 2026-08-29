'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/config';

interface PendingOffer {
  offer_id: string;
  sku: string;
  quantity: number;
  final_price_paise: number;
  total_order_paise: number;
  delivery_promise: string;
  return_terms_days: number;
  payment_methods_allowed: string[];
  expires_at: string;
  policy_version: string;
  signed_at: string;
}

export default function ApprovalsPage() {
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [approverName, setApproverName] = useState('merchant_admin_akash');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  async function fetchPendingApprovals() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/pending-approvals`);
      const data = await res.json();
      if (data.pending_offers) {
        setPendingOffers(data.pending_offers);
      }
    } catch {
      // Mock fallback
      if (pendingOffers.length === 0) {
        setPendingOffers([
          {
            offer_id: 'offer-enterprise-bulk-01',
            sku: 'SPRINTPRO-X2',
            quantity: 10,
            final_price_paise: 394900,
            total_order_paise: 3949000, // ₹39,490 (exceeds ₹15,000 threshold)
            delivery_promise: 'Monday Guaranteed (2026-08-31)',
            return_terms_days: 10,
            payment_methods_allowed: ['upi', 'card'],
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            policy_version: 'v1',
            signed_at: new Date().toISOString(),
          },
        ]);
      }
    }
  }

  async function handleApprove(offerId: string) {
    setIsLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/${offerId}/human-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_name: approverName,
          notes: 'High-value order authorized by merchant administrator.',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage(`Offer ${offerId} successfully approved by "${approverName}" and transitioned to POLICY_APPROVED.`);
        fetchPendingApprovals();
      }
    } catch {
      setActionMessage(`Simulated approval by "${approverName}". Signed offer released to POLICY_APPROVED.`);
      setPendingOffers(pendingOffers.filter((o) => o.offer_id !== offerId));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReject(offerId: string) {
    setIsLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/${offerId}/human-reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_name: approverName,
          rejection_reason: 'Order quantity/value exceeds single-buyer risk policy.',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage(`Offer ${offerId} rejected by "${approverName}".`);
        fetchPendingApprovals();
      }
    } catch {
      setActionMessage(`Simulated rejection by "${approverName}".`);
      setPendingOffers(pendingOffers.filter((o) => o.offer_id !== offerId));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>👤</span> Human Approval Queue
            </h1>
            <p className="text-slate-400 mt-1">
              Phase 7 & 8: Review offers held in APPROVAL_PENDING when total order value &gt; ₹15,000 threshold
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Approver ID:</span>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </header>

        {actionMessage && (
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-sm font-mono text-emerald-400">
            {actionMessage}
          </div>
        )}

        {pendingOffers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-semibold text-white">Approval Queue is Clear</h3>
            <p className="text-sm">No offers are currently held in APPROVAL_PENDING.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>⚠️</span> Pending Review ({pendingOffers.length})
            </h2>

            <div className="space-y-4">
              {pendingOffers.map((offer) => {
                const totalInr = (offer.total_order_paise / 100).toLocaleString();
                const unitInr = (offer.final_price_paise / 100).toLocaleString();

                return (
                  <div
                    key={offer.offer_id}
                    className="bg-slate-900 border border-amber-800/60 rounded-xl p-6 space-y-4 shadow-lg"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-amber-950 text-amber-300 border border-amber-700 text-xs font-mono font-bold px-2.5 py-0.5 rounded">
                          APPROVAL_PENDING
                        </span>
                        <h3 className="font-mono text-cyan-400 font-bold">{offer.sku}</h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Offer ID: {offer.offer_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block">REQUESTED QUANTITY:</span>
                        <span className="text-slate-200 font-bold text-sm">{offer.quantity} units</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">UNIT PRICE:</span>
                        <span className="text-slate-200 font-bold text-sm">₹{unitInr}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">TOTAL ORDER VALUE:</span>
                        <span className="text-amber-400 font-bold text-base">₹{totalInr}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">POLICY THRESHOLD:</span>
                        <span className="text-red-400 font-bold text-xs">Exceeds ₹15,000</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="text-xs text-slate-400 font-mono">
                        Delivery: <strong className="text-blue-400">{offer.delivery_promise}</strong> • Returns: <strong className="text-slate-300">{offer.return_terms_days}d</strong> • Policy: <strong className="text-purple-300">{offer.policy_version}</strong>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleReject(offer.offer_id)}
                          disabled={isLoading}
                          className="bg-red-950 hover:bg-red-900 border border-red-700 text-red-300 font-semibold px-4 py-2 rounded-lg text-xs transition disabled:opacity-50"
                        >
                          ✕ Reject Offer
                        </button>
                        <button
                          onClick={() => handleApprove(offer.offer_id)}
                          disabled={isLoading}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition disabled:opacity-50"
                        >
                          ✓ Approve (Release to Signable)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
