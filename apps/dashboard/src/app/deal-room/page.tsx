'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
type PriorityFactor = 'price' | 'delivery_speed' | 'return_terms' | 'extras';

interface CompetingBid {
  merchant_id: string;
  merchant_name: string;
  sku: string;
  product_name: string;
  unit_price_paise: number;
  total_price_paise: number;
  discount_paise: number;
  delivery_promise: string;
  delivery_day_label: string;
  return_terms_days: number;
  extras_description: string;
  signed_contract: any;
  utility_scores: {
    price_score: number;
    delivery_score: number;
    return_score: number;
    extras_score: number;
    total_utility: number;
  };
}

export default function DealRoomPage() {
  const [dealMode, setDealMode] = useState<'single' | 'auction'>('single');

  // Single Merchant State
  const [rawQuery, setRawQuery] = useState(
    'running shoes under ₹4,000, delivered by Tuesday, easy returns, UPI'
  );
  const [budgetInr, setBudgetInr] = useState<number>(4000);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentMethod[]>(['upi']);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [singleOffer, setSingleOffer] = useState<DealTicketData | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // 3-Merchant Auction State
  const [auctionPriority, setAuctionPriority] = useState<'speed' | 'price' | 'extras'>('speed');
  const [auctionQuantity, setAuctionQuantity] = useState(20);
  const [auctionBudget, setAuctionBudget] = useState(30000);
  const [isAuctioning, setIsAuctioning] = useState(false);
  const [competingBids, setCompetingBids] = useState<CompetingBid[]>([]);
  const [auctionWinner, setAuctionWinner] = useState<CompetingBid | null>(null);
  const [auctionRationale, setAuctionRationale] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    const currentDay = d.getDay();
    const daysToAdd = (2 - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToAdd);
    setDeliveryDeadline(d.toISOString().split('T')[0] || '');
  }, []);

  // Single Merchant Negotiation
  const handleRunSingleDeal = async () => {
    setIsNegotiating(true);
    setSingleOffer(null);
    setExplanation(null);

    const buyerConstraints = {
      quantity,
      budget_max_paise: Math.round(budgetInr * 100),
      currency: 'INR',
      delivery_deadline: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : new Date().toISOString(),
      payment_preference: paymentPreferences,
      return_preference: 'easy returns',
      priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'SHOES-SPRINTPRO-X2',
          buyer_constraints: buyerConstraints,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const offer = data.offer;
        setSingleOffer({
          offer_id: offer.offer_id,
          sku: offer.sku,
          product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
          quantity: offer.quantity,
          list_price_paise: offer.list_price_paise || 429900,
          final_price_paise: offer.final_price_paise,
          discount_paise: offer.discount_paise,
          discount_reasons: offer.discount_reasons || [
            'Prepaid payment incentive (UPI rail selected)',
            'Inventory clearance volume match',
            'Guaranteed Tuesday delivery SLA satisfied',
          ],
          delivery_promise: offer.delivery_promise,
          return_terms_days: offer.return_terms_days,
          payment_methods_allowed: offer.payment_methods_allowed,
          expires_at: offer.expires_at,
          merchant_id: 'merchant-apex-retail',
          merchant_name: 'Apex Athletic Goods',
          signature: data.signed_contract?.signature || 'hmac_sha256_sig_sample_01',
          nonce: data.signed_contract?.nonce || 'nonce_single_use_01',
          state: 'SIGNED',
        });
        setExplanation(data.explanation || null);
      } else {
        throw new Error('API offline');
      }
    } catch {
      // Mock Fallback
      setSingleOffer({
        offer_id: 'off-sprintpro-' + Math.random().toString(36).substring(2, 8),
        sku: 'SHOES-SPRINTPRO-X2',
        product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
        quantity,
        list_price_paise: 429900,
        final_price_paise: 394900,
        discount_paise: 35000,
        discount_reasons: [
          'Prepaid UPI discount applied (₹150 off)',
          'Clearance bracket incentive (41 units in BLR hub)',
          'Guaranteed Tuesday delivery promise satisfied',
        ],
        delivery_promise: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : new Date().toISOString(),
        return_terms_days: 10,
        payment_methods_allowed: paymentPreferences,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        merchant_id: 'merchant-apex-retail',
        merchant_name: 'Apex Athletic Goods',
        signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
        nonce: 'nonce_98f12a3d7b4',
        state: 'SIGNED',
      });
      setExplanation(
        'DealFlow crafted a personalized offer for SprintPro X2 at ₹3,949 (₹350 discount from ₹4,299 list price) with guaranteed Tuesday delivery and 10-day returns.'
      );
    } finally {
      setIsNegotiating(false);
    }
  };

  // 3-Merchant Auction
  const handleRunAuction = async () => {
    setIsAuctioning(true);
    setCompetingBids([]);
    setAuctionWinner(null);
    setAuctionRationale(null);

    const priorities =
      auctionPriority === 'speed'
        ? ['delivery_speed', 'price', 'return_terms', 'extras']
        : auctionPriority === 'price'
        ? ['price', 'delivery_speed', 'extras', 'return_terms']
        : ['extras', 'delivery_speed', 'price', 'return_terms'];

    try {
      const res = await fetch(`${API_BASE_URL}/api/auction/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Corporate Gift Boxes',
          buyer_constraints: {
            quantity: auctionQuantity,
            budget_max_paise: auctionBudget * 100,
            currency: 'INR',
            delivery_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            destination_pincode: '560001',
            payment_preference: ['upi', 'card'],
            return_preference: 'flexible',
            priorities,
          },
        }),
      });

      const data = await res.json();
      if (data.auction) {
        setCompetingBids(data.auction.competing_bids);
        setAuctionWinner(data.auction.winner);
        setAuctionRationale(data.auction.decision_rationale);
      } else {
        throw new Error();
      }
    } catch {
      // Mock auction result
      const rawBids: CompetingBid[] = [
        {
          merchant_id: 'merchant-a-crafts',
          merchant_name: 'Merchant A (Artisanal Crafts)',
          sku: 'GIFTBOX-CORP-A',
          product_name: 'Executive Gift Box (A)',
          unit_price_paise: 2950000,
          total_price_paise: 2950000 * auctionQuantity,
          discount_paise: 250000,
          delivery_promise: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Thursday',
          return_terms_days: 7,
          extras_description: 'Free custom logo laser engraving & branding included',
          signed_contract: { offer_id: 'off-a-001', signature: 'sig_a_mock_hmac' },
          utility_scores: {
            price_score: 0.455,
            delivery_score: 0.5,
            return_score: 0.0,
            extras_score: 1.0,
            total_utility: auctionPriority === 'extras' ? 0.725 : 0.485,
          },
        },
        {
          merchant_id: 'merchant-b-bulk',
          merchant_name: 'Merchant B (Bulk Direct)',
          sku: 'GIFTBOX-CORP-B',
          product_name: 'Standard Corporate Box (B)',
          unit_price_paise: 2890000,
          total_price_paise: 2890000 * auctionQuantity,
          discount_paise: 210000,
          delivery_promise: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Friday',
          return_terms_days: 7,
          extras_description: 'Standard packaging (no custom branding)',
          signed_contract: { offer_id: 'off-b-001', signature: 'sig_b_mock_hmac' },
          utility_scores: {
            price_score: 1.0,
            delivery_score: 0.0,
            return_score: 0.0,
            extras_score: 0.0,
            total_utility: auctionPriority === 'price' ? 0.85 : 0.35,
          },
        },
        {
          merchant_id: 'merchant-c-express',
          merchant_name: 'Merchant C (Express Logistics)',
          sku: 'GIFTBOX-CORP-C',
          product_name: 'Priority Express Box (C)',
          unit_price_paise: 3000000,
          total_price_paise: 3000000 * auctionQuantity,
          discount_paise: 300000,
          delivery_promise: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Wednesday',
          return_terms_days: 15,
          extras_description: '15-day hassle-free replacement warranty included',
          signed_contract: { offer_id: 'off-c-001', signature: 'sig_c_mock_hmac' },
          utility_scores: {
            price_score: 0.0,
            delivery_score: 1.0,
            return_score: 1.0,
            extras_score: 0.0,
            total_utility: auctionPriority === 'speed' ? 0.775 : 0.32,
          },
        },
      ];

      let win = rawBids[2]!;
      let rat = 'Merchant C selected: Delivery speed was ranked #1 priority (Wednesday delivery beats Thursday and Friday).';
      if (auctionPriority === 'price') {
        win = rawBids[1]!;
        rat = 'Merchant B selected: Price was ranked #1 priority (₹28,900 unit price is lowest in market).';
      } else if (auctionPriority === 'extras') {
        win = rawBids[0]!;
        rat = 'Merchant A selected: Customization was ranked #1 priority (Free custom laser logo branding included).';
      }

      setCompetingBids(rawBids);
      setAuctionWinner(win);
      setAuctionRationale(rat);
    } finally {
      setIsAuctioning(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav currentStage="OFFER_GENERATED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip with Plain-English Explainer */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                VIEW 03 • LIVE DEAL ROOM CENTERPIECE
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Live Agent Deal Room
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Watch an AI buyer and your merchant agent negotiate a bounded offer in real time.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-ink-950 p-1 rounded-lg border border-ink-700">
            <button
              onClick={() => setDealMode('single')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                dealMode === 'single'
                  ? 'bg-ink-800 text-ink-100 font-bold border border-ink-600'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              Single-Merchant Deal (SprintPro X2)
            </button>
            <button
              onClick={() => setDealMode('auction')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                dealMode === 'auction'
                  ? 'bg-ink-800 text-ink-100 font-bold border border-ink-600'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              3-Merchant Auction (Gift Boxes)
            </button>
          </div>
        </div>

        {/* Mode 1: Single Merchant Flow */}
        {dealMode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Buyer Agent Controls */}
            <div className="lg:col-span-6 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
              <div className="border-b border-ink-800 pb-2">
                <h3 className="font-display text-base font-bold text-ink-100">
                  Buyer Agent Request
                </h3>
                <p className="text-xs text-ink-400 font-sans mt-0.5">
                  The buyer agent specifies its constraints. DealFlow will negotiate a personalized contract within policy.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                  Natural Language Query
                </label>
                <textarea
                  rows={2}
                  value={rawQuery}
                  onChange={(e) => setRawQuery(e.target.value)}
                  className="w-full bg-ink-950 border border-ink-700 rounded p-2.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Max Unit Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={budgetInr}
                    onChange={(e) => setBudgetInr(parseFloat(e.target.value) || 0)}
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

              <button
                onClick={handleRunSingleDeal}
                disabled={isNegotiating}
                className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors shadow disabled:opacity-50"
              >
                {isNegotiating ? 'Evaluating Policy & Signing Contract...' : 'Run Bilateral Negotiation →'}
              </button>
            </div>

            {/* Right Column: Stamped Deal Ticket */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                <h3 className="font-display text-base font-bold text-ink-100">
                  Signed Contract Ticket
                </h3>
                <span className="font-mono text-[10px] text-signal font-bold">
                  [ POLICY APPROVED ]
                </span>
              </div>

              {singleOffer ? (
                <div className="space-y-4">
                  <DealTicket
                    ticket={singleOffer}
                    onAccept={() => {
                      window.location.href = `/checkout?offer_id=${singleOffer.offer_id}&amount=${singleOffer.final_price_paise * singleOffer.quantity}`;
                    }}
                    onPay={() => {
                      window.location.href = `/checkout?offer_id=${singleOffer.offer_id}&amount=${singleOffer.final_price_paise * singleOffer.quantity}`;
                    }}
                  />

                  {explanation && (
                    <div className="bg-ink-900 border border-ink-700 rounded-lg p-4 text-xs text-ink-300 font-sans leading-relaxed">
                      <strong className="text-signal block font-mono text-[10px] uppercase mb-1">
                        Policy Explanation:
                      </strong>
                      {explanation}
                    </div>
                  )}

                  <div className="pt-2">
                    <Link
                      href={`/checkout?offer_id=${singleOffer.offer_id}&amount=${singleOffer.final_price_paise * singleOffer.quantity}`}
                      className="w-full py-2.5 px-4 bg-ink-800 hover:bg-ink-750 text-ink-100 border border-ink-600 font-sans text-xs font-bold rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Contract & Checkout</span>
                      <span className="font-mono">→</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-ink-800 rounded-lg p-10 text-center space-y-2 bg-ink-900/40">
                  <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
                    §
                  </div>
                  <h4 className="font-display text-base font-bold text-ink-300">
                    Deal Ticket Ready for Negotiation
                  </h4>
                  <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
                    Click <strong>"Run Bilateral Negotiation"</strong> on the left to watch DealFlow calculate discounts and generate the signed contract.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode 2: 3-Merchant Auction */}
        {dealMode === 'auction' && (
          <div className="space-y-6">
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-100">
                    3-Merchant Parallel Auction (Corporate Gift Boxes)
                  </h3>
                  <p className="text-xs text-ink-400 font-sans mt-0.5">
                    1 buyer RFP fans out to Merchants A, B, and C in parallel. Buyer agent picks winner using stated priorities (Speed vs. Price vs. Customization).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Requested Quantity
                  </label>
                  <input
                    type="number"
                    value={auctionQuantity}
                    onChange={(e) => setAuctionQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Max Unit Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={auctionBudget}
                    onChange={(e) => setAuctionBudget(parseFloat(e.target.value) || 0)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                    Buyer Priority Weighting
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setAuctionPriority('speed')}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                        auctionPriority === 'speed'
                          ? 'bg-signal-bg border-signal text-signal font-bold'
                          : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                      }`}
                    >
                      ⚡ Speed
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuctionPriority('price')}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                        auctionPriority === 'price'
                          ? 'bg-signal-bg border-signal text-signal font-bold'
                          : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                      }`}
                    >
                      💰 Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuctionPriority('extras')}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                        auctionPriority === 'extras'
                          ? 'bg-signal-bg border-signal text-signal font-bold'
                          : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                      }`}
                    >
                      ✨ Extras
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunAuction}
                disabled={isAuctioning}
                className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors shadow disabled:opacity-50"
              >
                {isAuctioning ? 'Broadcasting RFP to Merchants A, B, and C...' : 'Broadcast RFP to All 3 Merchants in Parallel →'}
              </button>
            </div>

            {/* Auction Winner Banner */}
            {auctionWinner && auctionRationale && (
              <div className="bg-signal-bg border border-signal-border rounded-lg p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-signal uppercase">
                    ✓ AUCTION WINNER: {auctionWinner.merchant_name}
                  </span>
                  <span className="font-mono text-xs text-signal font-bold">
                    SCORE: {auctionWinner.utility_scores.total_utility.toFixed(3)}
                  </span>
                </div>
                <p className="text-xs text-ink-200 font-sans leading-relaxed">
                  {auctionRationale}
                </p>
              </div>
            )}

            {/* 3 Competing Deal Tickets */}
            {competingBids.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {competingBids.map((bid) => {
                  const isCurrentWinner = auctionWinner?.sku === bid.sku;
                  const ticketData: DealTicketData = {
                    offer_id: bid.signed_contract?.offer_id || 'bid-' + bid.sku,
                    sku: bid.sku,
                    product_name: bid.product_name,
                    quantity: auctionQuantity,
                    list_price_paise: bid.unit_price_paise + bid.discount_paise,
                    final_price_paise: bid.unit_price_paise,
                    discount_paise: bid.discount_paise,
                    discount_reasons: [
                      bid.extras_description,
                      `Guaranteed ${bid.delivery_day_label} delivery`,
                      `${bid.return_terms_days}-day return warranty`,
                    ],
                    delivery_promise: bid.delivery_promise,
                    return_terms_days: bid.return_terms_days,
                    payment_methods_allowed: ['UPI', 'Card'],
                    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    merchant_id: bid.merchant_id,
                    merchant_name: bid.merchant_name,
                    signature: bid.signed_contract?.signature || 'hmac_mock_sig',
                    nonce: 'nonce_' + bid.sku.toLowerCase(),
                    state: isCurrentWinner ? 'SIGNED' : 'OFFER_CREATED',
                  };

                  return (
                    <div key={bid.sku} className="space-y-3">
                      <DealTicket
                        ticket={ticketData}
                        isCompetitorBid
                        isWinner={isCurrentWinner}
                        onPay={
                          isCurrentWinner
                            ? () => {
                                window.location.href = `/checkout?offer_id=${ticketData.offer_id}&amount=${ticketData.final_price_paise * auctionQuantity}`;
                              }
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-ink-800 rounded-lg p-12 text-center space-y-2 bg-ink-900/40">
                <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
                  ⚡
                </div>
                <h4 className="font-display text-base font-bold text-ink-300">
                  Ready for Parallel Broadcast
                </h4>
                <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
                  Click <strong>"Broadcast RFP to All 3 Merchants"</strong> to compare 3 independently calculated deal tickets side by side.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
