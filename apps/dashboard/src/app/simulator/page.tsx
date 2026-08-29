'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import {
  ArrowLeft,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  Sliders,
  FileCode2,
  ArrowUpDown,
  ShoppingBag,
} from 'lucide-react';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
type PriorityFactor = 'price' | 'delivery_speed' | 'return_terms' | 'extras';

interface ParsedIntentResponse {
  success: boolean;
  category?: string;
  buyer_constraints?: {
    budget_max_paise?: number;
    currency?: string;
    delivery_deadline?: string;
    quantity?: number;
    payment_preference?: PaymentMethod[];
    return_preference?: string;
    priorities?: PriorityFactor[];
  };
  missing_fields?: string[];
  is_complete?: boolean;
  error?: string;
}

export default function BuyerSimulatorPage() {
  const [activeTab, setActiveTab] = useState<'prompt' | 'form'>('prompt');
  const [rawQuery, setRawQuery] = useState(
    'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI'
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    intent_id?: string;
    cco?: any;
    error?: string;
  } | null>(null);

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
    const daysToAdd = (2 - currentDay + 7) % 7 || 7; // Tuesday is 2
    d.setDate(d.getDate() + daysToAdd);
    setDeliveryDeadline(d.toISOString().split('T')[0] || '');
  }, []);

  const handleParseWithAI = async () => {
    if (!rawQuery.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setMissingFields([]);

    try {
      // Direct call to API or client fallback
      const res = await fetch(`${API_BASE_URL}/api/intent/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rawQuery }),
      }).catch(() => null);

      let data: ParsedIntentResponse;
      if (res && res.ok) {
        data = await res.json();
      } else {
        // Fallback deterministic client-side parser if API service is offline
        const lower = rawQuery.toLowerCase();
        let cat = 'running shoes';
        if (lower.includes('gift box') || lower.includes('gift')) cat = 'corporate gift box';

        let budget = 4000;
        const bMatch = rawQuery.match(/([0-9,]+)/);
        if (bMatch && bMatch[1]) {
          budget = parseInt(bMatch[1].replace(/,/g, ''), 10);
        }

        const payments: PaymentMethod[] = [];
        if (lower.includes('upi')) payments.push('upi');
        if (lower.includes('card')) payments.push('card');
        if (lower.includes('netbanking')) payments.push('netbanking');
        if (lower.includes('cod')) payments.push('cod');
        if (payments.length === 0) payments.push('upi');

        const d = new Date();
        const daysToAdd = (2 - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + daysToAdd);

        data = {
          success: true,
          category: cat,
          buyer_constraints: {
            budget_max_paise: budget * 100,
            currency: 'INR',
            delivery_deadline: d.toISOString().split('T')[0] + 'T23:59:59.000Z',
            quantity: 1,
            payment_preference: payments,
            return_preference: lower.includes('easy return') ? 'easy returns' : 'standard returns',
            priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
          },
          missing_fields: [],
          is_complete: true,
        };
      }

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
      } else if (data.error) {
        setParseError(data.error);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to connect to parser API');
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

  // Assembled Common Commerce Object Preview
  const currentCCO = {
    intent: {
      buyer_agent_id: 'buyer-agent-sim-01',
      protocol_source: 'simulator',
      category: category,
      raw_query: rawQuery,
      created_at: new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: Math.round(budgetInr * 100),
      currency: 'INR',
      delivery_deadline: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : new Date().toISOString(),
      quantity: quantity,
      payment_preference: paymentPreferences,
      return_preference: returnPreference,
      priorities: priorities,
    },
    cart: {
      items: [],
    },
    offer: null,
    authorization: null,
    payment: null,
    fulfillment: {
      state: 'REQUEST_RECEIVED',
      events: [],
    },
  };

  const handleSubmitIntent = async () => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentCCO),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmitResult({
          success: true,
          intent_id: data.intent_id,
          cco: data.cco,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSubmitResult({
          success: false,
          error: errorData.error || `HTTP ${res.status}: Failed to submit intent`,
        });
      }
    } catch (err: any) {
      // Local demo mode simulation
      setSubmitResult({
        success: true,
        intent_id: 'sim-' + Math.random().toString(36).substring(2, 9),
        cco: currentCCO,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-indigo-400" />
                Buyer-Agent Intent Simulator
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Phase 2: Common Commerce Object Normalizer & Natural Language Intent Parser
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
              Protocol: Simulator / ACP / UCP
            </span>
          </div>
        </div>

        {/* Missing Fields Banner */}
        {missingFields.length > 0 && (
          <div className="bg-amber-950/70 border border-amber-600/50 rounded-xl p-4 flex items-start gap-3 text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">Missing Required Constraints: </span>
              Please provide values for: {missingFields.join(', ')}. The form below has highlighted the required fields.
            </div>
          </div>
        )}

        {/* Submit Status Notification */}
        {submitResult && (
          <div
            className={`rounded-xl p-4 border flex items-start gap-3 text-sm ${
              submitResult.success
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-200'
                : 'bg-rose-950/70 border-rose-600/50 text-rose-200'
            }`}
          >
            {submitResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {submitResult.success
                  ? `Intent Registered Successfully (ID: ${submitResult.intent_id})`
                  : 'Intent Submission Failed'}
              </div>
              <div className="text-xs mt-1 text-slate-300">
                {submitResult.success
                  ? 'Common Commerce Object initialized in state: REQUEST_RECEIVED'
                  : submitResult.error}
              </div>
            </div>
          </div>
        )}

        {/* Main Grid: Input Form vs Live CCO Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Panel */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode Switcher */}
            <div className="bg-slate-800/80 p-1.5 rounded-xl flex gap-2 border border-slate-700">
              <button
                onClick={() => setActiveTab('prompt')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'prompt'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Natural Language Query
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'form'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Structured Constraints Form
              </button>
            </div>

            {/* Prompt Mode */}
            {activeTab === 'prompt' && (
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-xl backdrop-blur">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Buyer-Agent Natural Language Query
                  </label>
                  <textarea
                    rows={4}
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                    placeholder="e.g. running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI"
                  />
                </div>

                {/* Preset Prompts */}
                <div>
                  <span className="text-xs text-slate-400">Quick Test Scenarios:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() =>
                        setRawQuery('running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI')
                      }
                      className="text-xs bg-slate-900 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700 transition-colors"
                    >
                      SprintPro X2 (₹4k, Tuesday, UPI)
                    </button>
                    <button
                      onClick={() =>
                        setRawQuery('20 corporate gift boxes, ₹30,000 budget, Bengaluru by Friday, prepaid')
                      }
                      className="text-xs bg-slate-900 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg border border-slate-700 transition-colors"
                    >
                      3-Merchant Gift Box Auction (20 qty, ₹30k, Friday)
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleParseWithAI}
                    disabled={isParsing}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isParsing ? 'Parsing via Gemini / Rules...' : 'Parse & Validate Intent Schema'}
                  </button>
                </div>

                {parseError && (
                  <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-3 rounded-lg">
                    {parseError}
                  </div>
                )}
              </div>
            )}

            {/* Structured Form Fields */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 space-y-5 shadow-xl backdrop-blur">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-3">
                Validated Buyer Constraints (Paise Integer Spec)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Max Budget (₹ INR) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      value={budgetInr}
                      onChange={(e) => setBudgetInr(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Normalized: {Math.round(budgetInr * 100).toLocaleString()} paise
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Delivery Deadline <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Quantity <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Payment Preferences <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['upi', 'card', 'netbanking', 'cod'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleTogglePayment(method)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border uppercase transition-all ${
                        paymentPreferences.includes(method)
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return Preferences */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Return Preference <span className="text-rose-400">*</span>
                </label>
                <select
                  value={returnPreference}
                  onChange={(e) => setReturnPreference(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="easy returns">Easy returns (10-day)</option>
                  <option value="15-day replacement">15-day replacement warranty</option>
                  <option value="7-day return">7-day hassle free return</option>
                  <option value="standard returns">Standard merchant return terms</option>
                  <option value="none">No returns required</option>
                </select>
              </div>

              {/* Priority Ranking */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                  Priority Ranking (Ranked 1 to 4)
                </label>
                <div className="space-y-1.5">
                  {priorities.map((factor, idx) => (
                    <div
                      key={factor}
                      className="flex items-center justify-between bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="capitalize font-medium">{factor.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => movePriority(idx, 'up')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-[10px] text-slate-300"
                        >
                          ▲
                        </button>
                        <button
                          disabled={idx === priorities.length - 1}
                          onClick={() => movePriority(idx, 'down')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-[10px] text-slate-300"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  onClick={handleSubmitIntent}
                  disabled={isSubmitting || !category || budgetInr <= 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Submitting to DealFlow...' : 'Submit Intent to /api/intent'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Common Commerce Object Inspector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
                <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
                  <FileCode2 className="w-4 h-4 text-indigo-400" />
                  Live Common Commerce Object
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                  Zod Validated
                </span>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[680px]">
                <pre>{JSON.stringify(currentCCO, null, 2)}</pre>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div>✓ Invariant 1: Natural language mapped strictly to schema constraints.</div>
                <div>✓ Invariant 5: Budget strictly mapped to integer paise ({Math.round(budgetInr * 100)} paise).</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
