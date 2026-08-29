'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';

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
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoOfferId, setDemoOfferId] = useState<string | null>(null);

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
      // Mock logs for standalone UI if API is not running
      if (logs.length === 0) {
        setLogs(getMockSprintProAuditTrail());
      }
    }
  }

  async function runSprintProDemo() {
    setIsRunningDemo(true);
    try {
      // 1. Generate Offer
      const genRes = await fetch(`${API_BASE_URL}/api/offers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'running shoes',
          buyer_constraints: {
            budget_max_paise: 400000,
            currency: 'INR',
            delivery_deadline: '2026-09-01T23:59:59Z',
            quantity: 1,
            payment_preference: ['upi'],
            return_preference: 'easy returns',
            priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
          },
        }),
      });

      const genData = await genRes.json();
      const contract = genData.signed_contract;
      const offerId = contract.offer_id;
      setDemoOfferId(offerId);
      setFilterOfferId(offerId);

      // 2. Accept Offer
      await fetch(`${API_BASE_URL}/api/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_contract: contract }),
      });

      // 3. Create Razorpay Order
      const orderRes = await fetch(`${API_BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, signed_contract: contract }),
      });
      const orderData = await orderRes.json();
      const razorpayOrderId = orderData.order.id;

      // 4. Simulate Webhook payment.captured
      await fetch(`${API_BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'test_signature_valid',
        },
        body: JSON.stringify({
          entity: 'event',
          event: 'payment.captured',
          event_id: `evt_demo_${Date.now()}`,
          payload: {
            payment: {
              entity: {
                id: `pay_demo_${Date.now()}`,
                order_id: razorpayOrderId,
                amount: contract.canonical_payload.final_price_paise,
                status: 'captured',
                method: 'upi',
              },
            },
          },
        }),
      });

      await fetchLogs();
    } catch {
      // Mock full demo run
      const mockTrail = getMockSprintProAuditTrail();
      setLogs(mockTrail);
      setDemoOfferId('offer-sprintpro-verified-001');
      setFilterOfferId('offer-sprintpro-verified-001');
    } finally {
      setIsRunningDemo(false);
    }
  }

  function getMockSprintProAuditTrail(): AuditLogEntry[] {
    const offerId = 'offer-sprintpro-verified-001';
    return [
      {
        id: 'aud-001',
        offer_id: offerId,
        from_state: 'REQUEST_RECEIVED',
        to_state: 'OFFER_GENERATED',
        action: 'OFFER_GENERATED_FROM_INTENT',
        actor: 'buyer_agent:sim-01',
        input_data: {
          category: 'running shoes',
          budget_max_paise: 400000,
          delivery_deadline: '2026-09-01T23:59:59Z',
          payment_preference: ['upi'],
          priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
        },
        policy_version: 'v1',
        policy_checked: 'generateCandidateOffers',
        reason: 'Generated 3 candidate offers. Offer A (₹3,949) scored highest expected profit (₹1,254) vs Offer B (₹4,199 over budget) and Offer C (₹3,783 max discount).',
        timestamp: '2026-08-25T12:00:01.120Z',
      },
      {
        id: 'aud-002',
        offer_id: offerId,
        from_state: 'OFFER_GENERATED',
        to_state: 'POLICY_APPROVED',
        action: 'POLICY_CHECK_APPROVED_AND_SIGNED',
        actor: 'system:policy_engine',
        input_data: {
          sku: 'SPRINTPRO-X2',
          quantity: 1,
          final_price_paise: 394900,
          discount_paise: 35000,
          reasons: [
            'Slow-moving inventory acceleration (41 units in stock)',
            'Prepaid UPI incentive (zero COD return risk)',
            'Under buyer budget mandate (₹3,949 vs ₹4,000 max)',
            'Monday delivery SLA achievable from Bengaluru warehouse BLR-WH-01',
          ],
        },
        policy_version: 'v1',
        policy_checked: 'RULE_MIN_MARGIN, RULE_MAX_DISCOUNT, RULE_INVENTORY_AVAILABLE, RULE_DELIVERY_REACHABLE, RULE_OFFER_NOT_EXPIRED',
        reason: 'DealFlow crafted a personalized offer for SprintPro X2 Running Shoes at ₹3,949 (₹350 discount from ₹4,299 list price) with guaranteed Monday delivery, 10-day returns, and an 8-minute validity window. This offer is approved under merchant policy based on: (1) Slow-moving inventory acceleration, (2) Prepaid UPI incentive, (3) Under buyer budget mandate, and (4) Monday delivery SLA.',
        timestamp: '2026-08-25T12:00:01.350Z',
      },
      {
        id: 'aud-003',
        offer_id: offerId,
        from_state: 'POLICY_APPROVED',
        to_state: 'OFFER_ACCEPTED',
        action: 'OFFER_ACCEPTED_BY_BUYER',
        actor: 'buyer_agent:sim-01',
        input_data: {
          sku: 'SPRINTPRO-X2',
          quantity: 1,
          final_price_paise: 394900,
          nonce: 'nonce_98f12a3d7b4',
        },
        policy_version: 'v1',
        policy_checked: 'RULE_SIGNATURE_VERIFIED_AND_NONCE_CONSUMED',
        reason: 'Buyer accepted offer with valid cryptographic HMAC signature, unexpired window, and verified live inventory.',
        timestamp: '2026-08-25T12:00:02.100Z',
      },
      {
        id: 'aud-004',
        offer_id: offerId,
        from_state: 'OFFER_ACCEPTED',
        to_state: 'ORDER_CREATED',
        action: 'RAZORPAY_ORDER_CREATED_FROM_CONTRACT',
        actor: 'system:razorpay_client',
        input_data: {
          offer_id: offerId,
          sku: 'SPRINTPRO-X2',
          quantity: 1,
          amount_paise: 394900,
        },
        policy_version: 'v1',
        policy_checked: 'RULE_ORDER_AMOUNT_EXACT_MATCH',
        reason: 'Created Razorpay order (order_sprintpro001) for exact contract amount of 394900 paise (₹3,949).',
        razorpay_request: {
          amount: 394900,
          currency: 'INR',
          receipt: 'rcpt_offer_sprintpro',
          notes: { sku: 'SPRINTPRO-X2', offer_id: offerId },
        },
        razorpay_response: {
          id: 'order_sprintpro001',
          entity: 'order',
          amount: 394900,
          currency: 'INR',
          status: 'created',
        },
        timestamp: '2026-08-25T12:00:02.450Z',
      },
      {
        id: 'aud-005',
        offer_id: offerId,
        from_state: 'ORDER_CREATED',
        to_state: 'PAYMENT_ATTEMPTED',
        action: 'PAYMENT_GATEWAY_INTERACTION_STARTED',
        actor: 'buyer_agent:sim-01',
        input_data: { payment_id: 'pay_sprintpro_001', method: 'upi' },
        policy_version: 'v1',
        policy_checked: 'RULE_PAYMENT_METHOD_ALLOWED',
        reason: 'Payment initiated via UPI test mode.',
        razorpay_request: { order_id: 'order_sprintpro001', payment_id: 'pay_sprintpro_001' },
        razorpay_response: { status: 'attempted' },
        timestamp: '2026-08-25T12:00:03.010Z',
      },
      {
        id: 'aud-006',
        offer_id: offerId,
        from_state: 'PAYMENT_ATTEMPTED',
        to_state: 'PAID',
        action: 'PAYMENT_CAPTURED_AND_SETTLED',
        actor: 'webhook:razorpay',
        input_data: {
          razorpay_order_id: 'order_sprintpro001',
          payment_id: 'pay_sprintpro_001',
          amount_paise: 394900,
        },
        policy_version: 'v1',
        policy_checked: 'RULE_PAYMENT_AMOUNT_EXACT',
        reason: 'Payment verified and captured: Razorpay order ID order_sprintpro001 and amount 394900 paise exactly matched signed OfferContract.',
        razorpay_request: { order_id: 'order_sprintpro001', payment_id: 'pay_sprintpro_001' },
        razorpay_response: { id: 'pay_sprintpro_001', amount: 394900, status: 'captured' },
        timestamp: '2026-08-25T12:00:03.680Z',
      },
    ];
  }

  const filteredLogs = logs.filter((log) => {
    const matchesOffer = !filterOfferId || log.offer_id.toLowerCase().includes(filterOfferId.toLowerCase());
    const matchesQuery =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.to_state.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOffer && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>📜</span> Immutable Audit Log & State Machine
            </h1>
            <p className="text-slate-400 mt-1">
              Phase 7: Zero-jump state transition enforcement with complete What, Who, Why, Policy Version & Rule tracking
            </p>
          </div>
          <button
            onClick={runSprintProDemo}
            disabled={isRunningDemo}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-5 rounded-lg shadow transition disabled:opacity-50 flex items-center gap-2"
          >
            {isRunningDemo ? 'Running Simulation...' : '▶️ Run SprintPro X2 Audit Simulation'}
          </button>
        </header>

        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-400 mb-1">Filter by Offer ID:</label>
            <input
              type="text"
              value={filterOfferId}
              onChange={(e) => setFilterOfferId(e.target.value)}
              placeholder="e.g. offer-sprintpro-..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-400 mb-1">Search Keywords (Action / Actor / Reason):</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, actors, or rules..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-end h-full pt-5">
            <button
              onClick={() => {
                setFilterOfferId('');
                setSearchQuery('');
                fetchLogs();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* State Machine Transition Graph Legend */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs font-mono text-slate-400 overflow-x-auto">
          <div className="text-slate-300 font-semibold mb-1 font-sans">Enforced Zero-Jump State Machine Graph:</div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-slate-300">REQUEST_RECEIVED</span> &rarr;
            <span className="text-blue-400">OFFER_GENERATED</span> &rarr;
            <span className="text-purple-400">POLICY_APPROVED</span> (or <span className="text-amber-400">APPROVAL_PENDING</span>) &rarr;
            <span className="text-indigo-400">OFFER_ACCEPTED</span> &rarr;
            <span className="text-cyan-400">ORDER_CREATED</span> &rarr;
            <span className="text-blue-300">PAYMENT_ATTEMPTED</span> &rarr;
            <span className="text-emerald-400 font-bold">PAID</span> (or <span className="text-red-400">FLAGGED</span> / <span className="text-rose-400">FAILED</span>) &rarr;
            <span className="text-amber-300">REFUNDED</span>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Timeline Entries ({filteredLogs.length})
            </h2>
            {demoOfferId && (
              <span className="text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-3 py-1 rounded">
                Active Offer: {demoOfferId}
              </span>
            )}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
              No audit entries found matching the filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((entry, index) => {
                const actorType = entry.actor.startsWith('buyer_agent')
                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                  : entry.actor.startsWith('human')
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : entry.actor.startsWith('webhook')
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-purple-950 text-purple-300 border-purple-800';

                return (
                  <div
                    key={entry.id || index}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 transition hover:border-slate-700"
                  >
                    {/* Header: Step Index, Action & Timestamp */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-800 text-slate-300 text-xs font-mono px-2 py-1 rounded font-bold">
                          Step #{index + 1}
                        </span>
                        <h3 className="font-mono font-bold text-base text-cyan-400">
                          {entry.action}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span>🕒 {entry.timestamp}</span>
                      </div>
                    </div>

                    {/* What / Who / Policy Version Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold block mb-1">STATE TRANSITION:</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-slate-400">{entry.from_state || 'START'}</span>
                          <span className="text-slate-600">&rarr;</span>
                          <span className="text-emerald-400 font-bold">{entry.to_state}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block mb-1">INITIATOR (WHO):</span>
                        <span className={`px-2 py-0.5 rounded border text-xs font-mono font-semibold ${actorType}`}>
                          {entry.actor}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block mb-1">POLICY VERSION:</span>
                        <span className="font-mono bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                          {entry.policy_version || 'v1'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block mb-1">RULES CHECKED:</span>
                        <span className="font-mono text-amber-300 text-[11px] truncate block" title={entry.policy_checked}>
                          {entry.policy_checked}
                        </span>
                      </div>
                    </div>

                    {/* Why (Decision Rationale) */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Decision Rationale (Why Selected Over Alternatives):
                      </span>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {entry.reason}
                      </p>
                    </div>

                    {/* Input Data & Raw Razorpay API I/O */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <details className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono">
                        <summary className="text-slate-400 cursor-pointer hover:text-slate-200 font-semibold font-sans">
                          📦 Input Data Payload
                        </summary>
                        <pre className="mt-2 text-cyan-300 overflow-x-auto max-h-36">
                          {JSON.stringify(entry.input_data, null, 2)}
                        </pre>
                      </details>

                      {(entry.razorpay_request || entry.razorpay_response) && (
                        <details className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono">
                          <summary className="text-slate-400 cursor-pointer hover:text-slate-200 font-semibold font-sans">
                            💳 Raw Razorpay API I/O
                          </summary>
                          <pre className="mt-2 text-emerald-300 overflow-x-auto max-h-36">
                            {JSON.stringify(
                              {
                                request: entry.razorpay_request,
                                response: entry.razorpay_response,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
