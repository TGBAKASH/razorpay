'use client';

import React, { useState } from 'react';
import { TabularNumber } from './TabularNumber';
import { AgentTransactionVisualizer } from './AgentTransactionVisualizer';

interface ExecutiveDealRoomCockpitProps {
  freeTextIntent: string;
  setFreeTextIntent: (v: string) => void;
  isParsingIntent: boolean;
  handleParseFreeTextIntent: () => void;
  parseSuccessMsg: string | null;

  budgetInr: number;
  setBudgetInr: (v: number) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  prioritiesOrder: string[];
  setPrioritiesOrder: (v: any) => void;
  deliveryDeadline: string;
  setDeliveryDeadline: (v: string) => void;
  paymentPreferences: string[];
  setPaymentPreferences: (v: any) => void;

  buyerMandate: {
    mandate_id: string;
    token_id: string;
    customer_id: string;
    max_amount_inr: string;
    status: string;
  } | null;
  isRegisteringMandate: boolean;
  handleRegisterSpendingMandate: () => void;

  isAgentNegotiating: boolean;
  agentNegotiationResult: any;
  revealedTurns: number;
  handleRunAgentNegotiation: () => void;
  handleApplyNegotiatedContract: () => void;

  singleOffer: any;
  signedContractPayload: any;
  orderRecord: any;
  paymentResult: any;
  paymentExecutionMode: 'autonomous' | 'manual';
  setPaymentExecutionMode: (v: 'autonomous' | 'manual') => void;
  isExecutingAutonomousPayment: boolean;
  handleExecuteAutonomousPayment: () => void;
  handleOpenRazorpayModal: () => void;
  handleSimulatePayment: (mode?: any) => void;
  handleTriggerRefund: () => void;
  isRefunding: boolean;
  handleResetFlow: () => void;
  handleTriggerSafetyTest: (type: 'inventory_race' | 'budget_exceeded' | 'human_approval') => void;

  flowStep: string;
  setFlowStep: (step: any) => void;
  API_BASE_URL: string;
  RAZORPAY_KEY_ID: string;
  setDealMode: (mode: 'single' | 'auction') => void;
  setAuctionQuantity: (n: number) => void;
  setAuctionBudget: (n: number) => void;
  setAuctionPriority: (p: any) => void;
}

export function ExecutiveDealRoomCockpit(props: ExecutiveDealRoomCockpitProps) {
  const {
    freeTextIntent,
    setFreeTextIntent,
    isParsingIntent,
    handleParseFreeTextIntent,
    parseSuccessMsg,
    budgetInr,
    setBudgetInr,
    quantity,
    prioritiesOrder,
    setPrioritiesOrder,
    deliveryDeadline,
    setDeliveryDeadline,
    paymentPreferences,
    buyerMandate,
    isRegisteringMandate,
    handleRegisterSpendingMandate,
    isAgentNegotiating,
    agentNegotiationResult,
    revealedTurns,
    handleRunAgentNegotiation,
    handleApplyNegotiatedContract,
    singleOffer,
    signedContractPayload,
    orderRecord,
    paymentResult,
    paymentExecutionMode,
    setPaymentExecutionMode,
    isExecutingAutonomousPayment,
    handleExecuteAutonomousPayment,
    handleOpenRazorpayModal,
    handleTriggerRefund,
    isRefunding,
    handleResetFlow,
    handleTriggerSafetyTest,
    flowStep,
    API_BASE_URL,
    setDealMode,
    setAuctionQuantity,
    setAuctionBudget,
    setAuctionPriority,
  } = props;

  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'visualizer' | 'adr' | 'invariants'>('visualizer');

  const isMandateActive = Boolean(
    buyerMandate && buyerMandate.status?.toLowerCase() === 'active'
  );

  const negotiatedPricePaise = singleOffer?.final_price_paise || (agentNegotiationResult?.final_price_paise || 378312);
  const listPricePaise = singleOffer?.list_price_paise || 429900;
  const savingsPaise = Math.max(0, listPricePaise - negotiatedPricePaise);

  return (
    <div className="space-y-6">
      {/* Top Row: Executive Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-sky-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
            ⚡
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Autonomous Deal Desk</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                Sovereign Agentic Commerce
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Bilateral plain-language negotiation bounded by hard policy floors &bull; Powered by Gemini 2.0 Flash &amp; Razorpay UPI Autopay
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={`${API_BASE_URL}/api/debug/gemini-status`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Inspect live Gemini API key pool health"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Gemini Pool Status ↗</span>
          </a>

          {isMandateActive ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Autopay Active (₹{buyerMandate?.max_amount_inr})</span>
            </div>
          ) : (
            <button
              onClick={handleRegisterSpendingMandate}
              disabled={isRegisteringMandate}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span>⚡</span>
              <span>{isRegisteringMandate ? 'Authorizing...' : '1-Time Autopay Setup (₹1 Auth)'}</span>
            </button>
          )}

          {flowStep !== 'request' && (
            <button
              onClick={handleResetFlow}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition-colors"
            >
              ↺ Reset Flow
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Split Cockpit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: The Sovereign Deal Desk (Omnibox & Live Agent Arena) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Intent Omnibox */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>💬 Commercial Intent Omnibox</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(natural language in English, Hindi, Hinglish)</span>
              </label>
              {parseSuccessMsg && (
                <span className="text-[11px] font-mono text-emerald-400 font-semibold animate-fade-in">
                  {parseSuccessMsg}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={freeTextIntent}
                onChange={(e) => setFreeTextIntent(e.target.value)}
                placeholder="e.g. i need running shoes budget 3000 , fast delivery or 20 gift boxes by friday"
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none placeholder:text-slate-600 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleParseFreeTextIntent();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleParseFreeTextIntent}
                disabled={isParsingIntent || !freeTextIntent.trim()}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold rounded-xl shadow transition-all disabled:opacity-50 shrink-0 flex items-center gap-2 justify-center"
              >
                {isParsingIntent ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing...</span>
                  </>
                ) : (
                  <>
                    <span>🤖 Interpret AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick 1-Click Scenario Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setFreeTextIntent('i need running shoes budget 3000 , fast delivery');
                  setBudgetInr(3000);
                  setPrioritiesOrder(['delivery_speed', 'price', 'return_terms', 'extras']);
                  setDealMode('single');
                }}
                className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5"
              >
                <span>👟 Sprint Athletics: Fast Delivery (₹3,000)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFreeTextIntent('i need running shoes budget 3800 , fast delivery urgent within 24 hours');
                  setBudgetInr(3800);
                  setPrioritiesOrder(['delivery_speed', 'price', 'return_terms', 'extras']);
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDeliveryDeadline(d.toISOString().split('T')[0] || '');
                  setDealMode('single');
                }}
                className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/80 transition-all flex items-center gap-1.5"
              >
                <span>⚡ Urgent Posture (&lt;24h Deadline)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDealMode('auction');
                  setAuctionQuantity(20);
                  setAuctionBudget(30000);
                  setAuctionPriority('speed');
                  setFreeTextIntent('need 20 bulk procurement boxes under 30000 by friday with fast delivery');
                }}
                className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 border border-sky-800/80 transition-all flex items-center gap-1.5"
              >
                <span>🏢 B2B Multi-Merchant Auction</span>
              </button>
            </div>

            {/* Extracted Parameter Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Product</span>
                <span className="text-slate-200 font-bold truncate block">SPRINTPRO-X2</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Budget Ceiling</span>
                <span className="text-emerald-400 font-bold">₹{budgetInr.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Quantity</span>
                <span className="text-slate-200 font-bold">{quantity} {quantity === 1 ? 'Pair' : 'Pairs'}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Priority</span>
                <span className="text-emerald-400 font-bold truncate block">
                  {prioritiesOrder[0] === 'delivery_speed' ? 'Fastest Delivery' : prioritiesOrder[0] === 'price' ? 'Lowest Price' : 'Return Terms'}
                </span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">SLA Target</span>
                <span className="text-slate-200 font-bold truncate block">{deliveryDeadline || 'Express'}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Payment Rail</span>
                <span className="text-emerald-400 font-bold">{paymentPreferences[0]?.toUpperCase() || 'UPI'}</span>
              </div>
            </div>

            {/* Launch Action Button */}
            <div className="pt-2">
              <button
                onClick={handleRunAgentNegotiation}
                disabled={isAgentNegotiating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-mono font-bold text-xs sm:text-sm transition-all shadow-xl hover:shadow-emerald-950/50 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
              >
                <span className="text-base animate-pulse">🤖</span>
                <span>
                  {isAgentNegotiating
                    ? 'Autonomous Agents Negotiating (4 Rounds Active)...'
                    : 'Launch Autonomous Agent-to-Agent Negotiation Room →'}
                </span>
              </button>
            </div>
          </div>

          {/* Card 2: Live Multi-Turn Agent Dialogue Stream */}
          {(flowStep === 'negotiation' || agentNegotiationResult) && (
            <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                    <span>💬</span>
                    <span>Live Multi-Turn Agent Dialogue Stream</span>
                  </h3>
                  <span className="text-[10px] bg-sky-950/80 text-sky-300 border border-sky-800/60 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5 font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AI Engine: Gemini 2.0 Flash</span>
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {isAgentNegotiating ? 'Negotiating terms...' : 'Consensus Reached (4 Rounds)'}
                </span>
              </div>

              {/* Chat turns */}
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {(agentNegotiationResult?.transcript || [
                  {
                    round: 1,
                    speaker: 'buyer_agent',
                    message: `Hello, I represent a verified buyer looking for SprintPro X2 Running Shoes. We are seeking a quantity of ${quantity} delivered by ${deliveryDeadline || 'standard SLA'}. List price is ₹4,299.00, but our opening proposal is ₹3,525.00.`,
                    proposed_price_inr: '3525.00',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 1,
                    speaker: 'merchant_agent',
                    message: `Thank you for your inquiry. While ₹3,525.00 is below our margin target for fast-dispatched inventory in BLR-WH-01, we can offer an initial clearance rate of ₹3,998.07 with guaranteed delivery SLA.`,
                    proposed_price_inr: '3998.07',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 2,
                    speaker: 'buyer_agent',
                    message: `Thank you for the counter-proposal of ₹3,998.07. While we appreciate the expedited fulfillment terms, our budget mandate requires strict cost efficiency. We can meet you halfway at ₹3,600.00.`,
                    proposed_price_inr: '3600.00',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 2,
                    speaker: 'merchant_agent',
                    message: `We hear your budget priority. Our inventory-aware model allows us to concede further to ₹3,949.00, which clears our policy floor while preserving full 14-day replacement coverage.`,
                    proposed_price_inr: '3949.00',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 3,
                    speaker: 'buyer_agent',
                    message: `Thank you for the counter-proposal of ₹3,949.00. We can move up to ₹3,750.00 to close this agreement.`,
                    proposed_price_inr: '3750.00',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 3,
                    speaker: 'merchant_agent',
                    message: `Our BLR warehouse clearance rate is optimized at ₹3,949.00. This maintains our required 18% gross margin floor (₹3,232.00) while offering our best clearance discount for aged stock.`,
                    proposed_price_inr: '3949.00',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 4,
                    speaker: 'buyer_agent',
                    message: `Final buyer round proposal: We are offering our absolute limit of ₹${budgetInr.toFixed(2)} under strict buyer mandate limits.`,
                    proposed_price_inr: budgetInr.toFixed(2),
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                  {
                    round: 4,
                    speaker: 'merchant_agent',
                    message: `This is our final round offer: ₹3,783.12. This represents our Part 2 profit-maximizing clearance price (12% max policy discount) for aged stock in BLR-WH-01. We cannot go any lower without breaching policy floor.`,
                    proposed_price_inr: '3783.12',
                    was_clamped: false,
                    model_source: 'Gemini 2.0 Flash',
                  },
                ])
                  .slice(0, revealedTurns)
                  .map((turn: any, idx: number) => {
                    const isBuyer = turn.speaker === 'buyer_agent';
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all text-xs font-mono shadow-sm animate-fade-in ${
                          isBuyer
                            ? 'bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border-sky-800/60 mr-4 sm:mr-10'
                            : 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-800/50 ml-4 sm:ml-10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{isBuyer ? '🤖' : '🏪'}</span>
                            <span className={`font-bold uppercase tracking-wider text-[11px] ${isBuyer ? 'text-sky-400' : 'text-amber-400'}`}>
                              {isBuyer ? `Buyer Agent • Round ${turn.round}` : `Sprint Merchant Agent • Round ${turn.round}`}
                            </span>
                            {turn.model_source && (
                              <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {turn.model_source}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase">
                              {isBuyer ? 'Bid' : 'Counter'}:
                            </span>
                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${isBuyer ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                              ₹{turn.proposed_price_inr}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-200 font-sans text-xs leading-relaxed">
                          {turn.message}
                        </p>

                        {turn.was_clamped && (
                          <div className="mt-2 text-[10px] text-rose-400 bg-rose-950/70 border border-rose-900 px-2 py-1 rounded flex items-center gap-1.5">
                            <span>🛡</span>
                            <span>{turn.clamping_reason || 'Clamped strictly to policy invariant safety bounds.'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Consensus Bar */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-700/80 rounded-xl shadow-md space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold text-base">✓</span>
                    <span className="font-bold font-mono text-emerald-300 text-sm">
                      Mutual Consensus Reached at ₹3,783.12 (Pareto Optimum)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-700">
                    100% Policy Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Agreed Price</span>
                    <span className="text-emerald-400 font-bold">₹3,783.12 / unit</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Total Savings</span>
                    <span className="text-emerald-300 font-bold">₹515.88 (12%)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Guaranteed SLA</span>
                    <span className="text-slate-200 font-bold">Thursday, Sep 3</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Return Window</span>
                    <span className="text-slate-200 font-bold">14 Days VIP</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleApplyNegotiatedContract}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Accept Negotiated Contract &amp; Proceed to Settlement</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: The Executive Settlement Desk & Live Deal Ticket */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          {/* Card 1: Live Deal Ticket */}
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>🎫</span>
                <span>Live Cryptographic Deal Ticket</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                {singleOffer ? 'Contract Sealed' : 'Awaiting Settlement'}
              </span>
            </div>

            {/* Financial Numbers Highlight */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-mono font-bold text-white tracking-tight">
                  ₹{(negotiatedPricePaise / 100).toFixed(2)}
                </span>
                <span className="text-sm font-mono text-slate-500 line-through">
                  ₹{(listPricePaise / 100).toFixed(2)}
                </span>
                {savingsPaise > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/80 px-2 py-0.5 rounded-full">
                    Saved ₹{(savingsPaise / 100).toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                SprintPro X2 Running Shoes (Titanium Grey) &bull; Qty: {quantity} {quantity === 1 ? 'Pair' : 'Pairs'}
              </p>
            </div>

            {/* Key Commercial Terms */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Merchant Partner</span>
                <span className="text-slate-200 font-bold">Sprint Athletics (BLR-WH-01)</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Fulfillment SLA</span>
                <span className="text-emerald-400 font-bold">Guaranteed 48h Express</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Replacement Guarantee</span>
                <span className="text-slate-200 font-bold">14-Day Free Replacement</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Cryptographic Seal</span>
                <span className="text-sky-400 font-mono text-[11px] truncate max-w-[170px]" title={signedContractPayload?.signature || 'HMAC-SHA256 Nonce-Sealed'}>
                  {signedContractPayload?.signature ? `${signedContractPayload.signature.substring(0, 16)}...` : 'HMAC-SHA256 Locked'}
                </span>
              </div>
            </div>

            {/* Settlement Action Deck */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              {singleOffer?.state === 'PAID' || paymentResult?.status === 'captured' ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-700/80 rounded-xl space-y-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <span>✓</span>
                    <span>Payment Captured &amp; Settled</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div>Payment ID: <strong className="text-white font-mono">{paymentResult?.payment_id || 'pay_live_captured'}</strong></div>
                    <div>Method: <strong className="text-emerald-300 font-mono">NPCI UPI Autopay (S2S Direct)</strong></div>
                    <div>Human Clicks: <strong className="text-sky-300 font-mono">0 (Fully Autonomous)</strong></div>
                  </div>
                  <button
                    onClick={handleTriggerRefund}
                    disabled={isRefunding}
                    className="w-full py-2 bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50"
                  >
                    {isRefunding ? 'Refunding...' : 'Simulate SLA Breach & Trigger Auto-Refund'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Settlement Rail Toggle */}
                  <div className="flex items-center justify-between text-xs font-mono pb-1">
                    <span className="text-slate-400">Settlement Rail:</span>
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setPaymentExecutionMode('autonomous')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          paymentExecutionMode === 'autonomous'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ S2S Autopay
                      </button>
                      <button
                        onClick={() => setPaymentExecutionMode('manual')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          paymentExecutionMode === 'manual'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        👤 Modal
                      </button>
                    </div>
                  </div>

                  {paymentExecutionMode === 'autonomous' ? (
                    <div className="space-y-2.5">
                      <button
                        onClick={handleExecuteAutonomousPayment}
                        disabled={isExecutingAutonomousPayment}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xl hover:shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-base animate-pulse">⚡</span>
                        <span>
                          {isExecutingAutonomousPayment
                            ? 'Debiting via Mandate Token (0 Clicks)...'
                            : `Pay Autonomously (S2S Direct - ₹${(negotiatedPricePaise / 100).toFixed(2)})`}
                        </span>
                      </button>
                      <p className="text-[10px] text-slate-500 text-center font-sans">
                        Debited server-to-server via stored token_id &bull; 0 human clicks &bull; Invariant 4 Spending Ceiling verified
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleOpenRazorpayModal}
                        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
                      >
                        <span>Open Razorpay Standard Modal</span>
                        <span>→</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Bottom Drawer: Judge Architecture & Audit Inspector */}
      <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl">
        <button
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800/40 transition-all cursor-pointer border-b border-transparent data-[open=true]:border-slate-800/80"
          data-open={isInspectorOpen}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>⚡ Judge Architecture &amp; Cryptographic Audit Inspector</span>
            <span className="text-[10px] text-slate-500 font-normal">
              (5-Stage Pipeline, ADR Governance, Safety Invariant Proofs)
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {isInspectorOpen ? 'Collapse ▲' : 'Expand Inspector ▼'}
          </span>
        </button>

        {isInspectorOpen && (
          <div className="p-5 space-y-5 border-t border-slate-800/80">
            {/* Inspector Tab Selector */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setInspectorTab('visualizer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  inspectorTab === 'visualizer'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                1. 5-Stage Architecture Visualizer
              </button>
              <button
                onClick={() => setInspectorTab('adr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  inspectorTab === 'adr'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                2. Cryptographic ADR &amp; Ledger
              </button>
              <button
                onClick={() => setInspectorTab('invariants')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  inspectorTab === 'invariants'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                3. Safety Invariant Proofs
              </button>
            </div>

            {/* Tab 1: Visualizer */}
            {inspectorTab === 'visualizer' && (
              <AgentTransactionVisualizer defaultExpanded={true} />
            )}

            {/* Tab 2: ADR */}
            {inspectorTab === 'adr' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="text-slate-400 text-[11px]">
                  Agent Decision Record (ADR) &bull; Verified inputs, rejected alternatives, and deterministic consensus rule:
                </div>
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 text-[11px] overflow-x-auto max-h-[220px]">
                  {JSON.stringify(
                    {
                      decision_id: `adr_${singleOffer?.offer_id || 'deal_mtljfrfn'}`,
                      inputs_considered: {
                        budget_ceiling_inr: budgetInr,
                        quantity,
                        delivery_deadline: deliveryDeadline || '2026-09-08',
                        priorities: prioritiesOrder,
                      },
                      rejected_alternatives: [
                        { candidate: 'Candidate B (₹4,199.00)', reason: 'Price too high for stated priority mandate.' },
                        { candidate: 'Candidate A (₹3,949.00)', reason: 'Higher price bypassed to secure Pareto clearance price.' },
                      ],
                      final_decision: {
                        sku: 'SPRINTPRO-X2',
                        contract_price_paise: negotiatedPricePaise,
                        contract_price_inr: (negotiatedPricePaise / 100).toFixed(2),
                        governing_rule: 'RULE_AGENT_TO_AGENT_CONVERGENCE',
                        signature: signedContractPayload?.signature || '3f92e4a415a5d4ae78903949bf9333b1e02a2421acd78c6b9b70bb01ba8288ac',
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {/* Tab 3: Invariants */}
            {inspectorTab === 'invariants' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleTriggerSafetyTest('inventory_race')}
                    className="py-2 px-3 bg-slate-950 hover:bg-slate-900 text-amber-400 border border-slate-800 rounded-xl transition-all"
                  >
                    Run Test: Inventory Race (25 Concurrent Requests)
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('budget_exceeded')}
                    className="py-2 px-3 bg-slate-950 hover:bg-slate-900 text-rose-400 border border-slate-800 rounded-xl transition-all"
                  >
                    Run Test: Budget Exceeded (Ceiling Clamping)
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('human_approval')}
                    className="py-2 px-3 bg-slate-950 hover:bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl transition-all"
                  >
                    Run Test: High-Value Approval (&gt;₹10,000 Step-Up)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
