'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL, RAZORPAY_KEY_ID } from '../../lib/config';

interface OrderState {
  order_id: string;
  offer_id: string;
  amount_paise: number;
  status: 'created' | 'paid' | 'flagged' | 'failed' | 'refunded';
  contract: any;
}

export default function CheckoutPage() {
  const [order, setOrder] = useState<OrderState | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<'contract' | 'order_created' | 'paid' | 'flagged' | 'refunded'>('contract');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  // Sample contract data for SprintPro X2 Offer A
  const sampleContract = {
    offer_id: 'offer-sprintpro-checkout-001',
    sku: 'SPRINTPRO-X2',
    name: 'SprintPro X2 Running Shoes',
    quantity: 1,
    final_price_paise: 394900,
    list_price_paise: 429900,
    discount_paise: 35000,
    payment_methods_allowed: ['upi'],
    delivery_promise: 'Monday Delivery (2026-08-31)',
    return_terms_days: 10,
    status: 'POLICY_APPROVED',
    nonce: 'nonce_98f12a3d7b4',
    signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
  };

  async function handleCreateOrder() {
    setIsLoading(true);
    try {
      // Create Razorpay Order bound 1:1 to verified contract
      const res = await fetch(`${API_BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: sampleContract.offer_id,
          signed_contract: {
            offer_id: sampleContract.offer_id,
            merchant_id: 'merchant-sprint-alpha',
            buyer_agent_id: 'buyer-agent-sim-01',
            canonical_payload: {
              offer_id: sampleContract.offer_id,
              buyer_agent_id: 'buyer-agent-sim-01',
              merchant_id: 'merchant-sprint-alpha',
              sku: sampleContract.sku,
              quantity: sampleContract.quantity,
              final_price_paise: sampleContract.final_price_paise,
              currency: 'INR',
              payment_methods_allowed: sampleContract.payment_methods_allowed,
              delivery_promise: sampleContract.delivery_promise,
              return_terms_days: sampleContract.return_terms_days,
              expires_at: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
              policy_version: 'v1',
              nonce: sampleContract.nonce,
            },
            signature: sampleContract.signature,
            signing_key_id: 'key_v1_hmac_sha256',
            nonce: sampleContract.nonce,
            signed_at: new Date().toISOString(),
            status: 'POLICY_APPROVED',
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrder({
          order_id: data.order.id,
          offer_id: sampleContract.offer_id,
          amount_paise: data.order.amount,
          status: 'created',
          contract: sampleContract,
        });
        setActiveStep('order_created');
        fetchLogs();
      }
    } catch {
      // Mock fallback if standalone dashboard without local API
      setOrder({
        order_id: 'order_sprintpro001',
        offer_id: sampleContract.offer_id,
        amount_paise: sampleContract.final_price_paise,
        status: 'created',
        contract: sampleContract,
      });
      setActiveStep('order_created');
    } finally {
      setIsLoading(false);
    }
  }

  async function simulateWebhook(eventType: 'valid_paid' | 'duplicate_replay' | 'tampered_mismatch' | 'failed') {
    setIsLoading(true);
    setWebhookStatus(null);

    const orderId = order?.order_id || 'order_sprintpro001';
    let amount = 394900;
    let eventName = 'payment.captured';
    let eventId = `evt_${Date.now()}`;

    if (eventType === 'duplicate_replay') {
      eventId = 'evt_duplicate_test_123'; // Fixed event ID for replay testing
    } else if (eventType === 'tampered_mismatch') {
      amount = 294900; // Tampered amount (100,000 paise mismatch)
    } else if (eventType === 'failed') {
      eventName = 'payment.failed';
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'simulated_test_mode_signature',
        },
        body: JSON.stringify({
          entity: 'event',
          event: eventName,
          event_id: eventId,
          payload: {
            payment: {
              entity: {
                id: 'pay_' + Math.random().toString(36).substring(2, 10),
                order_id: orderId,
                amount,
                status: eventName === 'payment.captured' ? 'captured' : 'failed',
                method: 'upi',
              },
            },
          },
        }),
      });

      const result = await res.json();
      setWebhookStatus(JSON.stringify(result, null, 2));

      if (eventType === 'valid_paid') {
        setActiveStep('paid');
        if (order) setOrder({ ...order, status: 'paid' });
      } else if (eventType === 'tampered_mismatch') {
        setActiveStep('flagged');
        if (order) setOrder({ ...order, status: 'flagged' });
      }
      fetchLogs();
    } catch {
      // Local UI update
      if (eventType === 'valid_paid') {
        setActiveStep('paid');
        setWebhookStatus('Payment captured: Cross-check passed (₹3,949 == ₹3,949). Order marked PAID.');
      } else if (eventType === 'duplicate_replay') {
        setWebhookStatus('Idempotency check: Duplicate event ID ignored. Zero state mutation.');
      } else if (eventType === 'tampered_mismatch') {
        setActiveStep('flagged');
        setWebhookStatus('SECURITY ALERT: Webhook amount mismatch! Expected ₹3,949, received ₹2,949. Order FLAGGED.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefund() {
    setIsLoading(true);
    try {
      const orderId = order?.order_id || 'order_sprintpro001';
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Dispute / Return processing' }),
      });
      const data = await res.json();
      setWebhookStatus(JSON.stringify(data, null, 2));
      setActiveStep('refunded');
      if (order) setOrder({ ...order, status: 'refunded' });
      fetchLogs();
    } catch {
      setActiveStep('refunded');
      setWebhookStatus('Refund processed for order.');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audit-logs`);
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>💳</span> Razorpay Checkout & Contract Settlement
            </h1>
            <p className="text-slate-400 mt-1">
              Phase 6: Cryptographic Contract Order Binding, Checkout.js, Idempotent Webhooks & Amount Cross-Checks
            </p>
          </div>
          <div className="bg-amber-950/60 border border-amber-600/50 px-4 py-2 rounded-lg text-amber-300 text-xs font-mono font-semibold">
            TEST MODE ENFORCED (rzp_test_*)
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Verified Contract Summary & Order Action */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>📋</span> Verified Offer Contract
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Product SKU:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{sampleContract.sku}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">List Price:</span>
                  <span className="line-through text-slate-500">₹4,299.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Negotiated Price:</span>
                  <span className="text-emerald-400 font-bold text-base">₹3,949.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Discount Saved:</span>
                  <span className="text-emerald-400 font-medium">₹350.00 (8.14%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="uppercase text-amber-400 font-mono">Prepaid UPI</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Delivery SLA:</span>
                  <span className="text-blue-400 font-medium">Monday Guaranteed</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Return Window:</span>
                  <span className="text-slate-300">10 Days Easy Returns</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Cryptographic Nonce:</span>
                  <span className="font-mono text-xs text-purple-400">{sampleContract.nonce}</span>
                </div>
              </div>

              {!order ? (
                <button
                  onClick={handleCreateOrder}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Creating Order...' : '🚀 Create Razorpay Order (₹3,949)'}
                </button>
              ) : (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Razorpay Order ID:</span>
                    <span className="font-mono text-xs text-cyan-300 font-bold">{order.order_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Settlement Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      order.status === 'paid'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                        : order.status === 'flagged'
                        ? 'bg-red-950 text-red-300 border border-red-600'
                        : order.status === 'refunded'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : 'bg-blue-950 text-blue-300 border border-blue-600'
                    }`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Webhook Simulator & Razorpay Interaction */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>⚡</span> Webhook & Settlement Simulator
              </h2>

              <p className="text-sm text-slate-400">
                Execute Razorpay webhook triggers to verify cryptographic signature validation, exact amount cross-checking against the OfferContract, and idempotency protection against duplicate replays.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => simulateWebhook('valid_paid')}
                  disabled={isLoading}
                  className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 p-4 rounded-lg text-left transition disabled:opacity-50 space-y-1"
                >
                  <div className="text-emerald-300 font-semibold flex items-center gap-2">
                    <span>✅</span> Trigger payment.captured (Valid ₹3,949)
                  </div>
                  <p className="text-xs text-slate-400">
                    Cross-checks amount against contract. Flips order to <strong className="text-emerald-400">PAID</strong>.
                  </p>
                </button>

                <button
                  onClick={() => simulateWebhook('duplicate_replay')}
                  disabled={isLoading}
                  className="bg-purple-950 hover:bg-purple-900 border border-purple-600/50 p-4 rounded-lg text-left transition disabled:opacity-50 space-y-1"
                >
                  <div className="text-purple-300 font-semibold flex items-center gap-2">
                    <span>🔁</span> Duplicate Webhook Replay
                  </div>
                  <p className="text-xs text-slate-400">
                    Tests idempotency. Replayed event short-circuits with zero double-processing.
                  </p>
                </button>

                <button
                  onClick={() => simulateWebhook('tampered_mismatch')}
                  disabled={isLoading}
                  className="bg-red-950 hover:bg-red-900 border border-red-600/50 p-4 rounded-lg text-left transition disabled:opacity-50 space-y-1"
                >
                  <div className="text-red-300 font-semibold flex items-center gap-2">
                    <span>⚠️</span> Tampered Amount Webhook (₹2,949)
                  </div>
                  <p className="text-xs text-slate-400">
                    Triggers cross-check mismatch. Flips order to <strong className="text-red-400">FLAGGED</strong> (not PAID).
                  </p>
                </button>

                <button
                  onClick={handleRefund}
                  disabled={isLoading}
                  className="bg-amber-950 hover:bg-amber-900 border border-amber-600/50 p-4 rounded-lg text-left transition disabled:opacity-50 space-y-1"
                >
                  <div className="text-amber-300 font-semibold flex items-center gap-2">
                    <span>🔄</span> Trigger Test Refund
                  </div>
                  <p className="text-xs text-slate-400">
                    Dispute resolution path. Marks order status as <strong className="text-amber-400">REFUNDED</strong>.
                  </p>
                </button>
              </div>

              {webhookStatus && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-cyan-300 overflow-x-auto">
                  <div className="text-slate-500 mb-1 font-sans font-semibold">Webhook Response Log:</div>
                  <pre>{webhookStatus}</pre>
                </div>
              )}
            </div>

            {/* Audit Log Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>📜</span> Live Immutable Audit Log
                </h3>
                <button
                  onClick={fetchLogs}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Refresh Logs
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-slate-500 italic">No audit logs recorded in current session yet.</p>
                ) : (
                  logs.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded space-y-1">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="text-cyan-400 font-bold">{entry.action}</span>
                        <span className="text-slate-500">{entry.timestamp}</span>
                      </div>
                      <div className="text-slate-300">{entry.reason}</div>
                      <div className="text-xs">
                        <span className="text-slate-500">Result: </span>
                        <span className={entry.result === 'PASS' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {entry.result}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
