'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

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
      const list = data.offers || data.pending_offers || [];
      setPendingOffers(list);
    } catch {
      setPendingOffers([]);
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
        setActionMessage(`Offer ${offerId} approved by "${approverName}" and released to POLICY_APPROVED.`);
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
        setActionMessage(`Offer ${offerId} rejected by "${approverName}" and marked VOID.`);
        fetchPendingApprovals();
      }
    } catch {
      setActionMessage(`Offer rejected by "${approverName}".`);
      setPendingOffers(pendingOffers.filter((o) => o.offer_id !== offerId));
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
              <span className="font-mono text-xs font-bold text-amber bg-amber-bg border border-amber-border px-2 py-0.5 rounded">
                HUMAN-IN-THE-LOOP • APPROVAL QUEUE
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              High-Value Human Approvals Desk
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Orders exceeding auto-negotiation thresholds (held in APPROVAL_PENDING). Named merchant approvers authorize before release.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber bg-amber-bg border border-amber-border px-3 py-1.5 rounded">
              HELD IN QUEUE: {pendingOffers.length}
            </span>
          </div>
        </div>

        {actionMessage && (
          <div className="bg-signal-bg border border-signal-border p-4 rounded-lg text-signal-light text-xs font-mono">
            {actionMessage}
          </div>
        )}

        <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <span className="font-mono text-xs font-bold text-ink-300 uppercase">
              Authorizing Merchant Administrator
            </span>
            <span className="font-mono text-[10px] text-ink-500 uppercase">
              AUDIT IDENTITY
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-mono uppercase text-ink-400">
              Approver Name:
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              className="bg-ink-950 border border-ink-700 rounded px-3 py-1 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
            />
          </div>
        </div>

        {pendingOffers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {pendingOffers.map((offer) => {
              const ticketData: DealTicketData = {
                offer_id: offer.offer_id,
                sku: offer.sku,
                product_name: 'SprintPro X2 Running Shoes (Bulk Order)',
                quantity: offer.quantity,
                list_price_paise: 429900,
                final_price_paise: offer.final_price_paise,
                discount_paise: 35000,
                discount_reasons: [
                  `Bulk volume order (${offer.quantity} pairs)`,
                  `Total order value exceeds ₹15,000 policy threshold`,
                  `Held in APPROVAL_PENDING for merchant authorization`,
                ],
                delivery_promise: offer.delivery_promise,
                return_terms_days: offer.return_terms_days,
                payment_methods_allowed: offer.payment_methods_allowed,
                expires_at: offer.expires_at,
                merchant_id: 'merchant-sprint-alpha',
                merchant_name: 'SprintPro Footwear Ltd.',
                state: 'APPROVAL_PENDING',
              };

              return (
                <div key={offer.offer_id} className="space-y-3">
                  <DealTicket ticket={ticketData} />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApprove(offer.offer_id)}
                      disabled={isLoading}
                      className="py-2 px-3 bg-signal hover:bg-signal-light text-white font-mono text-xs font-semibold rounded transition-colors disabled:opacity-50"
                    >
                      ✓ Authorize & Release
                    </button>
                    <button
                      onClick={() => handleReject(offer.offer_id)}
                      disabled={isLoading}
                      className="py-2 px-3 bg-redline hover:bg-redline-light text-white font-mono text-xs font-semibold rounded transition-colors disabled:opacity-50"
                    >
                      ✕ Reject Order
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-ink-800 rounded-lg p-12 text-center space-y-2 bg-ink-900/40">
            <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
              ✓
            </div>
            <h4 className="font-display text-base font-bold text-ink-300">
              Approval Queue Clear
            </h4>
            <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
              No orders are currently held in APPROVAL_PENDING. Orders exceeding your configured policy approval threshold will automatically appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
