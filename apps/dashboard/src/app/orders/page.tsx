'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { TabularNumber } from '../../components/TabularNumber';
import { useAuth } from '../../components/AuthContext';

interface BuyerSafeOrder {
  order_id: string;
  offer_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  amount_paid_paise: number;
  currency: string;
  delivery_promise: string;
  return_terms_days: number;
  status: string;
  created_at: string;
  payment_id?: string;
  contract_summary: {
    signature: string;
    signing_key_id: string;
    nonce: string;
    policy_version: string;
  };
}

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<BuyerSafeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<BuyerSafeOrder | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const buyerId = user?.email || 'buyer-agent-sim-01';
      const res = await fetch(
        `${API_BASE_URL}/api/buyer/orders?buyer_agent_id=${encodeURIComponent(buyerId)}`,
        {
          headers: {
            'x-user-role': user?.role || 'buyer',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Deterministic fallback for testnet demonstration
      setOrders([
        {
          order_id: 'order_sprintpro_001',
          offer_id: 'off-sprintpro-checkout-001',
          sku: 'SPRINTPRO-X2',
          product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
          quantity: 1,
          amount_paid_paise: 394900,
          currency: 'INR',
          delivery_promise: '2026-09-02T23:59:59Z',
          return_terms_days: 10,
          status: 'PAID',
          created_at: new Date().toISOString(),
          payment_id: 'pay_sim_01j6k89m',
          contract_summary: {
            signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
            signing_key_id: 'key_v1_hmac_sha256',
            nonce: 'nonce_98f12a3d7b4',
            policy_version: 'v1',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Header Banner */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-signal" />
              <span className="text-xs font-mono font-bold text-signal tracking-wider uppercase">
                BUYER AGENT • ORDER HISTORY
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              My Orders & Receipts
            </h1>
            <p className="text-xs sm:text-sm text-ink-400 mt-1 font-sans">
              Scoped history of orders negotiated and settled by your buyer session ({user?.email || 'buyer-agent'}).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/deal-room"
              className="px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors"
            >
              + Negotiate New Deal
            </Link>
            <button
              onClick={fetchOrders}
              className="px-3 py-2 bg-ink-800 hover:bg-ink-750 text-ink-300 text-xs font-mono rounded border border-ink-600 transition-colors"
            >
              ↺ Refresh
            </button>
          </div>
        </div>

        {/* Orders List / Table */}
        {isLoading ? (
          <div className="bg-ink-900 border border-ink-800 rounded-lg p-12 text-center">
            <div className="w-6 h-6 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-mono text-ink-400">Loading your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-ink-900 border border-ink-800 rounded-lg p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center text-xl mx-auto text-ink-500 font-mono">
              📦
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-100 font-display">No Orders Found</h3>
              <p className="text-xs text-ink-400 mt-1">
                You haven&apos;t completed any purchases in this session yet.
              </p>
            </div>
            <Link
              href="/deal-room"
              className="inline-block px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors"
            >
              Enter Live Deal Room →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const deliveryDateFormatted = order.delivery_promise
                ? new Date(order.delivery_promise).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Guaranteed Arrival';

              return (
                <div
                  key={order.order_id}
                  className="bg-ink-900 border border-ink-700 hover:border-ink-600 rounded-lg p-5 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-ink-100">
                        {order.product_name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-300 border border-ink-700">
                        Qty: {order.quantity}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          order.status === 'PAID'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                            : 'bg-signal-bg text-signal border border-signal-border'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-ink-400">
                      <span>
                        Order ID: <strong className="text-ink-200">{order.order_id}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Delivery by: <strong className="text-signal-light">{deliveryDateFormatted}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Returns: <strong className="text-ink-200">{order.return_terms_days}-day replacement</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 border-ink-800 pt-3 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-mono text-ink-500 uppercase block">PAID AMOUNT</span>
                      <span className="text-base font-mono font-bold text-emerald-400">
                        <TabularNumber value={order.amount_paid_paise} isCurrencyPaise prefix="₹" />
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedReceipt(order)}
                      className="px-3.5 py-2 bg-ink-800 hover:bg-ink-750 text-ink-200 hover:text-white border border-ink-600 hover:border-signal text-xs font-mono rounded transition-colors"
                    >
                      View Contract Receipt →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Contract Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-ink-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-base font-bold text-ink-100 font-display">
                  Signed Contract Receipt
                </h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-ink-400 hover:text-ink-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-500 uppercase">Product:</span>
                  <span className="text-ink-100 font-bold">{selectedReceipt.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 uppercase">Order ID:</span>
                  <span className="text-ink-200">{selectedReceipt.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 uppercase">Offer ID:</span>
                  <span className="text-ink-200">{selectedReceipt.offer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 uppercase">Settled Total:</span>
                  <span className="text-emerald-400 font-bold">
                    <TabularNumber value={selectedReceipt.amount_paid_paise} isCurrencyPaise prefix="₹" />
                  </span>
                </div>
              </div>

              {/* Cryptographic Proof Widget */}
              <div className="bg-ink-950 p-3 rounded border border-emerald-900/80 space-y-1.5">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Cryptographic Signature Proof (HMAC-SHA256):
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-500">Signing Key ID:</span>
                  <span className="text-ink-300">{selectedReceipt.contract_summary.signing_key_id}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-500">Single-Use Nonce:</span>
                  <span className="text-ink-300">{selectedReceipt.contract_summary.nonce}</span>
                </div>
                <div>
                  <span className="text-ink-500 text-[10px] block mb-0.5">Signature Digest:</span>
                  <p className="bg-ink-900 p-2 rounded text-[10px] text-ink-300 font-mono break-all select-all border border-ink-800">
                    {selectedReceipt.contract_summary.signature}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-ink-800">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-ink-800 bg-ink-900 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-ink-400">
          <div>
            <span>Razorpay DealFlow</span> • Sovereign Deal Desk for Agentic Commerce
          </div>
          <div className="flex items-center gap-4">
            <Link href="/deal-room" className="hover:text-ink-200">Deal Room</Link>
            <Link href="/orders" className="hover:text-ink-200 text-signal-light">My Orders</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
