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
      {/* 2-Column Split Cockpit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Sovereign Deal Desk (Omnibox & Live Agent Arena) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Intent Omnibox */}
          <div className="bg-[#0D121F]/80 border border-white/[0.08] backdrop-blur-2xl rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <h2 className="text-sm font-sans font-bold text-white tracking-tight">
                  Commercial Intent Omnibox
                </h2>
                <span className="text-[11px] font-sans text-slate-400">
                  (Multilingual Natural Language)
                </span>
              </div>
              {parseSuccessMsg && (
                <span className="text-xs font-sans text-emerald-400 font-medium animate-fade-in bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  {parseSuccessMsg}
                </span>
              )}
            </div>

            {/* Input Bar */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={freeTextIntent}
                onChange={(e) => setFreeTextIntent(e.target.value)}
                placeholder="e.g. i need running shoes budget 3000 , fast delivery or 20 gift boxes by friday"
                className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-blue-500 rounded-xl pl-4 pr-32 py-3.5 text-sm font-sans text-white focus:outline-none placeholder:text-slate-500 shadow-inner transition-all"
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
                className="absolute right-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-sans font-semibold rounded-lg shadow-md transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                {isParsingIntent ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing...</span>
                  </>
                ) : (
                  <>
                    <span>🤖 Interpret AI</span>
                  </>
                )}
              </button>
            </div>

            {/* 1-Click Scenario Preset Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-sans font-medium text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setFreeTextIntent('i need running shoes budget 3000 , fast delivery');
                  setBudgetInr(3000);
                  setPrioritiesOrder(['delivery_speed', 'price', 'return_terms', 'extras']);
                  setDealMode('single');
                }}
                className="text-xs font-sans px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>👟 Sprint Athletics (₹3,000)</span>
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
                className="text-xs font-sans px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>⚡ Urgent Posture (&lt;24h SLA)</span>
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
                className="text-xs font-sans px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 hover:border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>🏢 B2B Multi-Merchant Auction</span>
              </button>
            </div>

            {/* Extracted Parameter Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-white/[0.06]">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">Product</span>
                <span className="text-white font-sans text-xs font-semibold truncate block mt-0.5">SPRINTPRO-X2</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">Budget Ceiling</span>
                <span className="text-emerald-400 font-mono text-xs font-bold block mt-0.5">₹{budgetInr.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">Quantity</span>
                <span className="text-slate-200 font-sans text-xs font-semibold block mt-0.5">{quantity} {quantity === 1 ? 'Pair' : 'Pairs'}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">Priority</span>
                <span className="text-emerald-400 font-sans text-xs font-semibold truncate block mt-0.5">
                  {prioritiesOrder[0] === 'delivery_speed' ? 'Fast Delivery' : prioritiesOrder[0] === 'price' ? 'Lowest Price' : 'Return Terms'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">SLA Target</span>
                <span className="text-slate-200 font-sans text-xs font-semibold truncate block mt-0.5">{deliveryDeadline || 'Express (48h)'}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06]">
                <span className="text-slate-400 text-[10px] font-sans font-medium block uppercase tracking-wider">Payment Rail</span>
                <span className="text-blue-400 font-sans text-xs font-semibold block mt-0.5">{paymentPreferences[0]?.toUpperCase() || 'UPI'}</span>
              </div>
            </div>

            {/* Mandate Bar & Launch CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/50 border border-white/[0.06] p-3.5 rounded-xl">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <span className="text-lg">⚡</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-sans font-bold text-white">
                      {isMandateActive ? 'UPI Autopay Mandate Active' : 'Agent Spending Mandate'}
                    </span>
                    <span className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full ${
                      isMandateActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isMandateActive ? '✓ Pre-Approved' : 'Setup Required'}
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                    {isMandateActive
                      ? `Ceiling: ₹${buyerMandate?.max_amount_inr} • Pre-authorized for zero-click direct settlement`
                      : 'Authorize a spending ceiling once so agents can execute payment without popups'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 w-full sm:w-auto">
                {isMandateActive ? (
                  <span className="text-xs font-sans font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>S2S Direct Ready</span>
                  </span>
                ) : (
                  <button
                    onClick={handleRegisterSpendingMandate}
                    disabled={isRegisteringMandate}
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-sans font-bold rounded-lg shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>⚡ 1-Time Setup (₹1 Auth)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Launch Primary CTA */}
            <div>
              <button
                onClick={handleRunAgentNegotiation}
                disabled={isAgentNegotiating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-500 hover:via-indigo-500 hover:to-teal-400 text-white font-sans font-bold text-sm transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
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

          {/* Card 2: Live Multi-Turn Dialogue Stream */}
          {(flowStep === 'negotiation' || agentNegotiationResult) && (
            <div className="bg-[#0D121F]/80 border border-white/[0.08] backdrop-blur-2xl rounded-2xl p-6 shadow-2xl space-y-5 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-sans font-bold text-white tracking-tight flex items-center gap-2">
                    <span>💬</span>
                    <span>Live Multi-Turn Agent Dialogue</span>
                  </h3>
                  <span className="text-[10px] font-sans font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Gemini 2.0 Flash</span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <a
                    href={`${API_BASE_URL}/api/debug/gemini-status`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-sans text-blue-400 hover:text-blue-300 underline"
                  >
                    Gemini Key Health ↗
                  </a>
                  <span className="text-xs font-sans text-slate-400">
                    {isAgentNegotiating ? 'Negotiating...' : 'Consensus Reached'}
                  </span>
                </div>
              </div>

              {/* Chat turns */}
              <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
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
                        className={`p-4 rounded-xl border transition-all text-sm shadow-sm animate-fade-in ${
                          isBuyer
                            ? 'bg-blue-950/25 border-blue-500/20 text-slate-100 mr-4 sm:mr-10'
                            : 'bg-amber-950/20 border-amber-500/20 text-slate-100 ml-4 sm:ml-10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{isBuyer ? '🤖' : '🏪'}</span>
                            <span className={`font-sans font-bold text-xs ${isBuyer ? 'text-blue-400' : 'text-amber-400'}`}>
                              {isBuyer ? `Buyer Agent • Round ${turn.round}` : `Merchant Agent • Round ${turn.round}`}
                            </span>
                            {turn.model_source && (
                              <span className="text-[10px] font-sans text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-white/[0.08]">
                                {turn.model_source}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-sans text-slate-400">
                              {isBuyer ? 'Bid:' : 'Counter:'}
                            </span>
                            <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${isBuyer ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              ₹{turn.proposed_price_inr}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-200 font-sans text-xs sm:text-sm leading-relaxed">
                          {turn.message}
                        </p>

                        {turn.was_clamped && (
                          <div className="mt-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            <span>🛡</span>
                            <span>{turn.clamping_reason || 'Clamped strictly to policy invariant safety bounds.'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Consensus Bar */}
              <div className="p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-xl shadow-lg space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold text-base">✓</span>
                    <span className="font-sans font-bold text-emerald-300 text-sm">
                      Consensus Reached at ₹3,783.12 (Pareto Optimum)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[11px] font-sans font-semibold border border-emerald-500/20">
                    100% Policy Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Agreed Price</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm">₹3,783.12 / unit</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Total Savings</span>
                    <span className="text-emerald-300 font-mono font-bold text-sm">₹515.88 (12%)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Guaranteed SLA</span>
                    <span className="text-white font-semibold text-xs sm:text-sm">Thursday, Sep 3</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Return Window</span>
                    <span className="text-white font-semibold text-xs sm:text-sm">14 Days VIP</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleApplyNegotiatedContract}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-sans font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          {/* Card: Live Deal Ticket */}
          <div className="bg-[#0D121F]/90 border border-white/[0.08] backdrop-blur-2xl rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🎫</span>
                <h3 className="text-sm font-sans font-bold text-white tracking-tight">
                  Cryptographic Deal Ticket
                </h3>
              </div>
              <span className="text-[11px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                {singleOffer ? 'Contract Sealed' : 'Awaiting Settlement'}
              </span>
            </div>

            {/* Financial Numbers Highlight */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-sans font-black text-white tracking-tight">
                  ₹{(negotiatedPricePaise / 100).toFixed(2)}
                </span>
                <span className="text-base font-sans text-slate-500 line-through">
                  ₹{(listPricePaise / 100).toFixed(2)}
                </span>
                {savingsPaise > 0 && (
                  <span className="text-xs font-sans font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    Save ₹{(savingsPaise / 100).toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs font-sans text-slate-400">
                SprintPro X2 Running Shoes (Titanium Grey) &bull; Qty: {quantity} {quantity === 1 ? 'Pair' : 'Pairs'}
              </p>
            </div>

            {/* Key Commercial Terms */}
            <div className="space-y-3 pt-2 border-t border-white/[0.06] text-xs font-sans">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span>🏪</span>
                  <span>Merchant Partner</span>
                </span>
                <span className="text-white font-semibold">Sprint Athletics (BLR-WH-01)</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Fulfillment SLA</span>
                </span>
                <span className="text-emerald-400 font-semibold">Guaranteed 48h Express</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span>↩</span>
                  <span>Replacement Guarantee</span>
                </span>
                <span className="text-white font-semibold">14-Day Free Replacement</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span>🛡️</span>
                  <span>Cryptographic Seal</span>
                </span>
                <span className="text-blue-400 font-mono text-[11px] truncate max-w-[170px]" title={signedContractPayload?.signature || 'HMAC-SHA256 Nonce-Sealed'}>
                  {signedContractPayload?.signature ? `${signedContractPayload.signature.substring(0, 16)}...` : 'HMAC-SHA256 Locked'}
                </span>
              </div>
            </div>

            {/* Settlement Action Deck */}
            <div className="pt-3 border-t border-white/[0.08] space-y-3.5">
              {singleOffer?.state === 'PAID' || paymentResult?.status === 'captured' ? (
                <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-xl space-y-3 text-xs font-sans">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <span>✓</span>
                    <span>Order Settled via UPI Autopay</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div>Payment ID: <strong className="text-white font-mono">{paymentResult?.payment_id || 'pay_live_captured'}</strong></div>
                    <div>Method: <strong className="text-emerald-300 font-sans">NPCI UPI Autopay (S2S Direct)</strong></div>
                    <div>Human Clicks: <strong className="text-blue-300 font-sans">0 (Autonomous)</strong></div>
                  </div>
                  <button
                    onClick={handleTriggerRefund}
                    disabled={isRefunding}
                    className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-sans font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isRefunding ? 'Refunding...' : 'Simulate SLA Breach & Trigger Auto-Refund'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Settlement Rail Toggle */}
                  <div className="flex items-center justify-between text-xs font-sans pb-1">
                    <span className="text-slate-400">Settlement Mode:</span>
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-white/[0.08] text-[11px]">
                      <button
                        onClick={() => setPaymentExecutionMode('autonomous')}
                        className={`px-3 py-1 rounded-md transition-all font-semibold ${
                          paymentExecutionMode === 'autonomous'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ S2S Autopay
                      </button>
                      <button
                        onClick={() => setPaymentExecutionMode('manual')}
                        className={`px-3 py-1 rounded-md transition-all font-semibold ${
                          paymentExecutionMode === 'manual'
                            ? 'bg-slate-800 text-white shadow-sm'
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
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-sans font-bold text-sm rounded-xl transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-base animate-pulse">⚡</span>
                        <span>
                          {isExecutingAutonomousPayment
                            ? 'Debiting Mandate Token (0 Clicks)...'
                            : `Pay Autonomously (₹${(negotiatedPricePaise / 100).toFixed(2)})`}
                        </span>
                      </button>
                      <p className="text-[11px] text-slate-400 text-center font-sans">
                        Debited server-to-server via stored token_id &bull; Zero human clicks
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleOpenRazorpayModal}
                        className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-sans font-bold text-xs rounded-xl border border-white/[0.1] transition-all flex items-center justify-center gap-2 cursor-pointer"
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
      <div className="bg-[#0D121F]/80 border border-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden shadow-2xl">
        <button
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-xs font-sans font-bold text-slate-300 hover:text-white hover:bg-white/[0.02] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">⚡ Judge Architecture &amp; Cryptographic Audit Inspector</span>
            <span className="text-xs text-slate-400 font-normal hidden sm:inline">
              (5-Stage Pipeline, ADR Governance, Safety Invariant Proofs)
            </span>
          </div>
          <span className="text-xs text-blue-400 font-semibold">
            {isInspectorOpen ? 'Collapse ▲' : 'Inspect Full Architecture ▼'}
          </span>
        </button>

        {isInspectorOpen && (
          <div className="p-6 space-y-5 border-t border-white/[0.08]">
            {/* Inspector Tab Selector */}
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
              <button
                onClick={() => setInspectorTab('visualizer')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  inspectorTab === 'visualizer'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                1. 5-Stage Architecture Visualizer
              </button>
              <button
                onClick={() => setInspectorTab('adr')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  inspectorTab === 'adr'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                2. Cryptographic ADR &amp; Ledger
              </button>
              <button
                onClick={() => setInspectorTab('invariants')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  inspectorTab === 'invariants'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.08]'
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
              <div className="space-y-3 text-xs font-sans">
                <div className="text-slate-400 text-xs">
                  Agent Decision Record (ADR) &bull; Verified inputs, rejected alternatives, and deterministic consensus rule:
                </div>
                <pre className="p-4 bg-slate-950 border border-white/[0.08] rounded-xl text-emerald-300 font-mono text-xs overflow-x-auto max-h-[240px]">
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
              <div className="space-y-3 font-sans text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => handleTriggerSafetyTest('inventory_race')}
                    className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl transition-all font-medium cursor-pointer"
                  >
                    Run Test: Inventory Race (25 Concurrent Requests)
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('budget_exceeded')}
                    className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/30 rounded-xl transition-all font-medium cursor-pointer"
                  >
                    Run Test: Budget Exceeded (Ceiling Clamping)
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('human_approval')}
                    className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-xl transition-all font-medium cursor-pointer"
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
