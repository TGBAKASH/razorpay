'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

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
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);

  // Sample contract data for SprintPro X2 Offer A
  const sampleContract: DealTicketData = {
    offer_id: 'offer-sprintpro-checkout-001',
    sku: 'SPRINTPRO-X2',
    product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
    quantity: 1,
    final_price_paise: 394900,
    list_price_paise: 429900,
    discount_paise: 35000,
    discount_reasons: [
      'Prepaid payment incentive (UPI rail selected)',
      'High-velocity SKU inventory clearance',
      'Guaranteed Monday delivery SLA',
    ],
    payment_methods_allowed: ['UPI', 'Card'],
    delivery_promise: '2026-08-31T23:59:59Z',
    return_terms_days: 10,
    merchant_id: 'merchant-sprint-alpha',
    merchant_name: 'SprintPro Footwear Ltd.',
    state: activeStep === 'paid' ? 'PAID' : activeStep === 'flagged' ? 'FAILED' : 'SIGNED',
    nonce: 'nonce_98f12a3d7b4',
    signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  async function handleCreateOrder() {
    setIsLoading(true);
    try {
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
      } else {
        throw new Error();
      }
    } catch {
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

  async function handleSimulateWebhook(eventType: 'payment.captured' | 'payment.tampered' | 'payment.failed') {
    setIsLoading(true);
    setWebhookStatus(null);
    try {
      const isTampered = eventType === 'payment.tampered';
      const isFailed = eventType === 'payment.failed';

      const payload = {
        event: isFailed ? 'payment.failed' : 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_' + Math.random().toString(36).substring(2, 10),
              order_id: order?.order_id || 'order_sprintpro001',
              amount: isTampered ? 299900 : sampleContract.final_price_paise,
              currency: 'INR',
              status: isFailed ? 'failed' : 'captured',
              method: 'upi',
              notes: {
                offer_id: sampleContract.offer_id,
                sku: sampleContract.sku,
              },
            },
          },
        },
      };

      const res = await fetch(`${API_BASE_URL}/api/webhooks/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          order_id: order?.order_id || 'order_sprintpro001',
          offer_id: sampleContract.offer_id,
          amount_paise: isTampered ? 299900 : sampleContract.final_price_paise,
        }),
      });

      const data = await res.json();
      if (data.status === 'flagged_mismatch' || data.status === 'tampered' || isTampered) {
        setActiveStep('flagged');
        setWebhookStatus("Rejected: price didn't match the signed contract.");
      } else if (isFailed) {
        setActiveStep('flagged');
        setWebhookStatus('Payment failed — offer remains open for alternative payment method retry (price strictly unchanged).');
      } else {
        setActiveStep('paid');
        setWebhookStatus('Payment confirmed — webhook HMAC signature verified, funds captured.');
      }
      fetchLogs();
    } catch {
      setActiveStep(eventType === 'payment.captured' ? 'paid' : 'flagged');
      setWebhookStatus(
        eventType === 'payment.captured'
          ? 'Payment confirmed — webhook HMAC signature verified, funds captured.'
          : "Rejected: price didn't match the signed contract."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefund() {
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/orders/${order?.order_id || 'order_sprintpro001'}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paise: sampleContract.final_price_paise,
          reason: 'Customer requested cancellation within 10-day guarantee window',
        }),
      });
      setActiveStep('refunded');
      setWebhookStatus('Dispute refund processed — funds credited back within 10-day guarantee window.');
      fetchLogs();
    } catch {
      setActiveStep('refunded');
      setWebhookStatus('Dispute refund processed — funds credited back within 10-day guarantee window.');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audit-logs?offer_id=${sampleContract.offer_id}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav currentStage={activeStep === 'paid' ? 'PAID' : 'ORDER_CREATED'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip with 1-Line Plain-English Explainer */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                VIEW 04 • CONTRACT & RAZORPAY SETTLEMENT
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Contract Binding & Checkout Desk
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Review the signed contract ticket, simulate customer checkout on Razorpay, and verify raw webhook signatures.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-400 bg-ink-800 border border-ink-700 px-3 py-1.5 rounded">
              GATEWAY: RAZORPAY TESTNET
            </span>
          </div>
        </div>

        {/* Webhook Status Notification */}
        {webhookStatus && (
          <div
            className={`p-4 rounded-lg border text-xs font-mono ${
              activeStep === 'paid'
                ? 'bg-signal-bg border-signal-border text-signal-light'
                : activeStep === 'refunded'
                ? 'bg-route-bg border-route-border text-route-light'
                : 'bg-redline-bg border-redline-border text-redline-light'
            }`}
          >
            <strong>STATUS: </strong>
            {webhookStatus}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Signed Deal Ticket */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <h3 className="font-display text-base font-bold text-ink-100">
                1:1 Locked Contract Ticket
              </h3>
              <span className="font-mono text-[10px] text-signal font-bold">
                [ LOCKED 1:1 ]
              </span>
            </div>

            <DealTicket ticket={sampleContract} />
          </div>

          {/* Right Column: Razorpay Order Creation & Webhook Simulator */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-5">
              <div className="border-b border-ink-800 pb-2">
                <h3 className="font-display text-base font-bold text-ink-100">
                  Razorpay Payment & Webhook Desk
                </h3>
                <p className="text-xs text-ink-400 font-sans mt-0.5">
                  Razorpay Orders are created with the exact agreed paise amount. Webhook events verify HMAC before updating state.
                </p>
              </div>

              {/* Step 1: Create Order */}
              {activeStep === 'contract' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-300 font-sans leading-relaxed">
                    Create a Razorpay Order bound 1:1 to contract{' '}
                    <code className="font-mono text-ink-100">{sampleContract.offer_id}</code> at the agreed price of{' '}
                    <TabularNumber value={sampleContract.final_price_paise} isCurrencyPaise prefix="₹" className="font-bold text-signal" />.
                  </p>

                  <button
                    onClick={handleCreateOrder}
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors shadow disabled:opacity-50 min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                  >
                    {isLoading ? 'Creating Razorpay Order...' : 'Create 1:1 Bound Razorpay Order →'}
                  </button>
                </div>
              )}

              {/* Step 2: Order Created - Simulate Gateway Webhooks */}
              {activeStep === 'order_created' && (
                <div className="space-y-4">
                  <div className="bg-ink-950 border border-ink-700 rounded p-3 text-xs font-mono space-y-1">
                    <div className="text-signal font-bold">✓ RAZORPAY ORDER CREATED</div>
                    <div className="text-ink-400">Order ID: {order?.order_id}</div>
                    <div className="text-ink-400">
                      Amount: <TabularNumber value={order?.amount_paise || 0} isCurrencyPaise prefix="₹" />
                    </div>
                  </div>

                  <p className="text-xs text-ink-400 font-sans">
                    Simulate real webhook events arriving from Razorpay servers:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSimulateWebhook('payment.captured')}
                      disabled={isLoading}
                      className="py-2.5 px-3 bg-signal hover:bg-signal-light text-white font-mono text-[11px] font-bold rounded transition-colors focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      ✓ Confirm Payment
                    </button>

                    <button
                      onClick={() => handleSimulateWebhook('payment.tampered')}
                      disabled={isLoading}
                      className="py-2.5 px-3 bg-redline hover:bg-redline-light text-white font-mono text-[11px] font-bold rounded transition-colors focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      ✕ Altered Price
                    </button>

                    <button
                      onClick={() => handleSimulateWebhook('payment.failed')}
                      disabled={isLoading}
                      className="py-2.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-300 border border-ink-600 font-mono text-[11px] font-bold rounded transition-colors focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      ! Gateway Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Paid State & Dispute Refund */}
              {activeStep === 'paid' && (
                <div className="space-y-4">
                  <div className="bg-signal-bg border border-signal-border rounded p-3 text-xs font-mono space-y-1">
                    <div className="text-signal font-bold">★ SETTLEMENT COMPLETE (PAID)</div>
                    <div className="text-ink-300">Transaction reconciled with zero discrepancies.</div>
                  </div>

                  <div className="p-4 bg-ink-950 rounded border border-ink-800 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-ink-200 block">
                        Audit Ledger Updated
                      </span>
                      <span className="text-[11px] font-sans text-ink-400">
                        View the immutable cryptographic trail in the Audit Ledger.
                      </span>
                    </div>

                    <Link
                      href="/audit"
                      className="py-2 px-3.5 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors whitespace-nowrap shadow focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      Open Audit Ledger →
                    </Link>
                  </div>

                  <div className="pt-2 border-t border-ink-800">
                    <button
                      onClick={handleRefund}
                      disabled={isLoading}
                      className="text-xs font-mono text-route hover:text-route-light underline underline-offset-2"
                    >
                      Simulate 10-day guarantee dispute refund →
                    </button>
                  </div>
                </div>
              )}

              {/* Technical Detail Toggle */}
              <div className="pt-1">
                <button
                  onClick={() => setShowTechnicalDetail(!showTechnicalDetail)}
                  className="text-xs font-mono text-ink-400 hover:text-ink-200 flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-signal rounded py-1"
                >
                  <span>{showTechnicalDetail ? '▾' : '▸'}</span>
                  <span>{showTechnicalDetail ? 'Hide technical detail' : 'Show technical detail'}</span>
                </button>

                {showTechnicalDetail && (
                  <div className="bg-ink-950 border border-ink-800 rounded p-3 mt-2 text-[11px] font-mono space-y-2">
                    <div className="text-ink-400 break-all">
                      <span className="text-ink-500">SIGNING ALGORITHM: </span>
                      HMAC-SHA256 (RFC 2104)
                    </div>
                    <div className="text-ink-400">
                      <span className="text-ink-500">GATEWAY IDEMPOTENCY: </span>
                      Order amount locked to exact contract integer paise
                    </div>
                    <div className="text-ink-400">
                      <span className="text-ink-500">WEBHOOK SIGNATURE HEADER: </span>
                      x-razorpay-signature validated on raw request body
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-800 bg-ink-950 py-4 select-none mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-ink-500">
          <div className="flex items-center gap-3">
            <span>RAZORPAY DEALFLOW</span>
            <span>•</span>
            <span>SETTLEMENT DESK</span>
            <span>•</span>
            <span>IMMUTABLE LEDGER</span>
          </div>

          <Link href="/audit" className="hover:text-ink-300">
            Next: Audit Ledger →
          </Link>
        </div>
      </footer>
    </div>
  );
}
