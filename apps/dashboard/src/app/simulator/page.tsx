'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
type PriorityFactor = 'price' | 'delivery_speed' | 'return_terms' | 'extras';

export default function BuyerSimulatorPage() {
  const [activeTab, setActiveTab] = useState<'prompt' | 'form'>('prompt');
  const [rawQuery, setRawQuery] = useState(
    'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI'
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [generatedOffer, setGeneratedOffer] = useState<DealTicketData | null>(null);
  const [negotiationExplanation, setNegotiationExplanation] = useState<string | null>(null);

  // Structured Form States
  const [category, setCategory] = useState('running shoes');
  const [budgetInr, setBudgetInr] = useState<number>(4000);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentMethod[]>(['upi']);
  const [returnPreference, setReturnPreference] = useState('easy returns');
  const [priorities, setPriorities] = useState<PriorityFactor[]>([
    'price',
    'delivery_speed',
    'return_terms',
    'extras',
  ]);

  // Set default deadline to next Tuesday on load
  useEffect(() => {
    const d = new Date();
    const currentDay = d.getDay();
    const daysToAdd = (2 - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToAdd);
    setDeliveryDeadline(d.toISOString().split('T')[0] || '');
  }, []);

  const handleParseWithAI = async () => {
    if (!rawQuery.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setMissingFields([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/intent/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rawQuery }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.buyer_constraints) {
          if (data.category) setCategory(data.category);
          if (data.buyer_constraints.budget_max_paise) {
            setBudgetInr(Math.round(data.buyer_constraints.budget_max_paise / 100));
          }
          if (data.buyer_constraints.delivery_deadline) {
            setDeliveryDeadline(data.buyer_constraints.delivery_deadline.split('T')[0] || '');
          }
          if (data.buyer_constraints.quantity) {
            setQuantity(data.buyer_constraints.quantity);
          }
          if (data.buyer_constraints.payment_preference) {
            setPaymentPreferences(data.buyer_constraints.payment_preference);
          }
          if (data.buyer_constraints.return_preference) {
            setReturnPreference(data.buyer_constraints.return_preference);
          }
          if (data.buyer_constraints.priorities) {
            setPriorities(data.buyer_constraints.priorities);
          }
          if (data.missing_fields && data.missing_fields.length > 0) {
            setMissingFields(data.missing_fields);
          }
        }
      } else {
        // Deterministic fallback
        const lower = rawQuery.toLowerCase();
        let cat = 'running shoes';
        if (lower.includes('gift box') || lower.includes('gift')) cat = 'corporate gift box';

        let budget = 4000;
        const bMatch = rawQuery.match(/([0-9,]+)/);
        if (bMatch && bMatch[1]) {
          budget = parseInt(bMatch[1].replace(/,/g, ''), 10);
        }
        setBudgetInr(budget);
        setCategory(cat);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse natural language intent');
    } finally {
      setIsParsing(false);
    }
  };

  const handleTogglePayment = (method: PaymentMethod) => {
    if (paymentPreferences.includes(method)) {
      if (paymentPreferences.length > 1) {
        setPaymentPreferences(paymentPreferences.filter((m) => m !== method));
      }
    } else {
      setPaymentPreferences([...paymentPreferences, method]);
    }
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= priorities.length) return;
    const reordered = [...priorities];
    const item = reordered[index];
    const target = reordered[newIdx];
    if (item && target) {
      reordered[index] = target;
      reordered[newIdx] = item;
      setPriorities(reordered);
    }
  };

  const handleExecuteNegotiation = async () => {
    setIsNegotiating(true);
    setGeneratedOffer(null);
    setNegotiationExplanation(null);

    const buyerConstraints = {
      quantity,
      budget_max_paise: Math.round(budgetInr * 100),
      currency: 'INR',
      delivery_deadline: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : new Date().toISOString(),
      payment_preference: paymentPreferences,
      return_preference: returnPreference,
      priorities,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: category.toLowerCase().includes('gift') ? 'GIFTBOX-CORP-A' : 'SHOES-SPRINTPRO-X2',
          buyer_constraints: buyerConstraints,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.offer) {
          const offer = data.offer;
          setGeneratedOffer({
            offer_id: offer.offer_id,
            sku: offer.sku,
            product_name: offer.sku.includes('SPRINTPRO') ? 'SprintPro X2 Running Shoes' : 'Corporate Gift Box Tier A',
            quantity: offer.quantity,
            list_price_paise: offer.list_price_paise || (offer.sku.includes('SPRINTPRO') ? 499900 : 3200000),
            final_price_paise: offer.final_price_paise,
            discount_paise: offer.discount_paise,
            discount_reasons: offer.discount_reasons || [
              'Prepaid payment incentive (₹150 off)',
              'Volume bracket discount applied',
              'Deterministic policy SLA match',
            ],
            delivery_promise: offer.delivery_promise,
            return_terms_days: offer.return_terms_days,
            payment_methods_allowed: offer.payment_methods_allowed,
            expires_at: offer.expires_at,
            merchant_id: 'merchant-apex-retail',
            merchant_name: 'Apex Athletic Goods (Merchant Desk)',
            signature: data.signed_contract?.signature || 'hmac_sha256_mock_sig_' + Math.random().toString(36),
            nonce: data.signed_contract?.nonce || 'nonce_' + Date.now(),
            state: 'SIGNED',
          });
          setNegotiationExplanation(data.explanation || null);
        }
      } else {
        // Local deterministic simulation fallback
        const listPaise = 499900;
        const discountPaise = 100000;
        const unitPaise = listPaise - discountPaise;
        setGeneratedOffer({
          offer_id: 'off-' + Math.random().toString(36).substring(2, 10),
          sku: 'SHOES-SPRINTPRO-X2',
          product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
          quantity,
          list_price_paise: listPaise,
          final_price_paise: unitPaise,
          discount_paise: discountPaise,
          discount_reasons: [
            'Prepaid payment discount (UPI rail selected)',
            'Inventory clearance bracket (18 units in BLR hub)',
            'Guaranteed Tuesday delivery promise satisfied',
          ],
          delivery_promise: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : new Date().toISOString(),
          return_terms_days: 10,
          payment_methods_allowed: paymentPreferences,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          merchant_id: 'merchant-apex-retail',
          merchant_name: 'Apex Athletic Goods',
          signature: 'a7f3c9e1b2049d5843a8719283746e5b1029384756abcdef0123456789abcdef',
          nonce: 'nonce_' + Date.now(),
          state: 'SIGNED',
        });
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to communicate with offer engine');
    } finally {
      setIsNegotiating(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav currentStage="REQUEST" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Stage Header */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                PHASE 01 • REQUEST & CCO NORMALIZER
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Buyer-Agent Intent Simulator
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Formulate buyer constraints, extract structured CCO via Gemini/Zod schemas, and negotiate directly with the deterministic merchant policy engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-400 bg-ink-800 border border-ink-700 px-3 py-1.5 rounded">
              PROTOCOL: CCO v1.0
            </span>
          </div>
        </div>

        {/* Missing Fields Alert */}
        {missingFields.length > 0 && (
          <div className="bg-amber-bg border border-amber-border rounded-lg p-4 text-amber-light text-xs font-mono">
            <strong className="text-amber uppercase">Missing Required Constraints: </strong>
            {missingFields.join(', ')}. Please update the constraints below.
          </div>
        )}

        {/* Error Alert */}
        {parseError && (
          <div className="bg-redline-bg border border-redline-border rounded-lg p-4 text-redline-light text-xs font-mono">
            <strong className="text-redline uppercase">Parser Error: </strong>
            {parseError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Input Panel */}
          <div className="lg:col-span-6 space-y-6">
            {/* Mode Tabs */}
            <div className="bg-ink-900 p-1 rounded-lg border border-ink-700 flex gap-1">
              <button
                onClick={() => setActiveTab('prompt')}
                className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                  activeTab === 'prompt'
                    ? 'bg-ink-800 text-ink-100 border border-ink-600 font-semibold'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                Natural Language Query
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                  activeTab === 'form'
                    ? 'bg-ink-800 text-ink-100 border border-ink-600 font-semibold'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                Structured Constraint Ledger
              </button>
            </div>

            {/* Natural Language Prompt Tab */}
            {activeTab === 'prompt' && (
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-ink-400 mb-2">
                    Buyer-Agent Request Text
                  </label>
                  <textarea
                    rows={3}
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    className="w-full bg-ink-950 border border-ink-700 rounded p-3 text-xs font-mono text-ink-100 placeholder-ink-600 focus:border-signal focus:outline-none"
                    placeholder="e.g. running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI"
                  />
                </div>

                {/* Preset Prompts */}
                <div>
                  <span className="text-[11px] font-mono text-ink-500 uppercase block mb-1.5">
                    Test Scenarios:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setRawQuery('running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI')
                      }
                      className="text-[11px] font-mono bg-ink-800 hover:bg-ink-750 text-ink-300 py-1 px-2.5 rounded border border-ink-700 transition-colors"
                    >
                      SprintPro X2 (₹4k, Tue, UPI)
                    </button>
                    <button
                      onClick={() =>
                        setRawQuery('20 corporate gift boxes, ₹30,000 budget, Bengaluru by Friday, prepaid')
                      }
                      className="text-[11px] font-mono bg-ink-800 hover:bg-ink-750 text-ink-300 py-1 px-2.5 rounded border border-ink-700 transition-colors"
                    >
                      Corporate Gift Boxes (20 units, ₹30k)
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleParseWithAI}
                  disabled={isParsing}
                  className="w-full py-2 px-4 bg-ink-800 hover:bg-ink-750 border border-ink-600 text-ink-100 font-sans text-xs font-semibold rounded transition-colors disabled:opacity-50"
                >
                  {isParsing ? 'Parsing Schema...' : 'Extract CCO Constraints →'}
                </button>
              </div>
            )}

            {/* Constraint Fields */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                <span className="font-mono text-xs font-bold text-ink-300 uppercase">
                  Buyer Constraints (Exact Units & Paise)
                </span>
                <span className="font-mono text-[10px] text-signal">
                  DETERMINISTIC
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs text-ink-100 font-sans focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Max Budget (INR)
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-ink-500">₹</span>
                    <input
                      type="number"
                      value={budgetInr}
                      onChange={(e) => setBudgetInr(parseFloat(e.target.value) || 0)}
                      className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                    />
                  </div>
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    Paise: <TabularNumber value={Math.round(budgetInr * 100)} /> paise
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Delivery Deadline
                  </label>
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1.5">
                  Allowed Payment Rails
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['upi', 'card', 'netbanking', 'cod'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleTogglePayment(method)}
                      className={`py-1 px-2.5 rounded text-xs font-mono uppercase border transition-colors ${
                        paymentPreferences.includes(method)
                          ? 'bg-signal-bg border-signal text-signal font-bold'
                          : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Ranking */}
              <div>
                <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1.5">
                  Priority Weights (Ranked #1 to #4)
                </label>
                <div className="space-y-1">
                  {priorities.map((factor, idx) => (
                    <div
                      key={factor}
                      className="flex items-center justify-between bg-ink-950 border border-ink-700 px-2.5 py-1.5 rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded bg-ink-800 text-signal font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-ink-200 capitalize">
                          {factor.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => movePriority(idx, 'up')}
                          className="px-1.5 py-0.5 bg-ink-800 hover:bg-ink-700 disabled:opacity-30 rounded text-[10px] text-ink-300 font-mono"
                        >
                          ▲
                        </button>
                        <button
                          disabled={idx === priorities.length - 1}
                          onClick={() => movePriority(idx, 'down')}
                          className="px-1.5 py-0.5 bg-ink-800 hover:bg-ink-700 disabled:opacity-30 rounded text-[10px] text-ink-300 font-mono"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Negotiation Action Button */}
              <button
                onClick={handleExecuteNegotiation}
                disabled={isNegotiating}
                className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow disabled:opacity-50 mt-2"
              >
                {isNegotiating ? 'Evaluating Deterministic Policy...' : 'Run Bilateral Negotiation →'}
              </button>
            </div>
          </div>

          {/* Right Column: Signature Deal Ticket & Execution Result */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="font-mono text-xs font-bold text-ink-300 uppercase">
                Generated Signed Contract Ticket
              </span>
              <span className="font-mono text-[10px] text-ink-500 uppercase">
                PHASE 02 & 03 OUTPUT
              </span>
            </div>

            {generatedOffer ? (
              <div className="space-y-4">
                <DealTicket
                  ticket={generatedOffer}
                  onAccept={() => {
                    window.location.href = `/checkout?offer_id=${generatedOffer.offer_id}&amount=${generatedOffer.final_price_paise * generatedOffer.quantity}`;
                  }}
                  onPay={() => {
                    window.location.href = `/checkout?offer_id=${generatedOffer.offer_id}&amount=${generatedOffer.final_price_paise * generatedOffer.quantity}`;
                  }}
                />

                {negotiationExplanation && (
                  <div className="bg-ink-900 border border-ink-700 rounded-lg p-4 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase text-signal font-bold tracking-wider">
                      Plain-English Policy Explanation:
                    </span>
                    <p className="text-xs text-ink-300 font-sans leading-relaxed">
                      {negotiationExplanation}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-ink-800 rounded-lg p-10 text-center space-y-2 bg-ink-900/40">
                <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
                  §
                </div>
                <h4 className="font-display text-base font-bold text-ink-300">
                  No Contract Generated Yet
                </h4>
                <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
                  Submit buyer constraints on the left to trigger deterministic merchant policy evaluation and generate an HMAC-signed deal ticket.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
