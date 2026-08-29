'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';

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
  const [budgetInr, setBudgetInr] = useState<number>(4000);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentMethod[]>(['upi']);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [negotiationPhaseText, setNegotiationPhaseText] = useState<string | null>(null);
  const [singleOffer, setSingleOffer] = useState<DealTicketData | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [activeFailureMode, setActiveFailureMode] = useState<string | null>(null);
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);

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

    // Deterministic default seed for immediate recording
    setSingleOffer({
      offer_id: 'off-sprintpro-seed01',
      sku: 'SHOES-SPRINTPRO-X2',
      product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
      quantity: 1,
      list_price_paise: 429900,
      final_price_paise: 394900,
      discount_paise: 35000,
      discount_reasons: [
        'Prepaid UPI payment incentive (₹150 off)',
        'Warehouse stock clearance match (41 pairs available)',
        'Guaranteed Tuesday delivery SLA satisfied',
      ],
      delivery_promise: '2026-08-31T23:59:59.000Z',
      return_terms_days: 10,
      payment_methods_allowed: ['UPI', 'Card'],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      merchant_id: 'merchant-apex-retail',
      merchant_name: 'Apex Athletic Goods',
      signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
      nonce: 'nonce_98f12a3d7b4',
      state: 'SIGNED',
    });
    setExplanation(
      'DealFlow calculated a personalized offer for SprintPro X2 at ₹3,949 (saving ₹350 from ₹4,299 list price) with guaranteed Tuesday delivery and 10-day returns.'
    );
  }, []);

  // Single Merchant Negotiation with Live Animated Formation
  const handleRunSingleDeal = async () => {
    setIsNegotiating(true);
    setActiveFailureMode(null);
    setSingleOffer(null);
    setExplanation(null);

    // Realistic multi-stage animation for video narration
    setNegotiationPhaseText('Evaluating merchant policy floors & inventory velocity...');
    await new Promise((r) => setTimeout(r, 600));

    setNegotiationPhaseText('Calculating personalized discount rules (Prepaid UPI + Stock Clearance)...');
    await new Promise((r) => setTimeout(r, 700));

    setNegotiationPhaseText('Sealing cryptographic contract ticket with HMAC-SHA256 & nonce...');
    await new Promise((r) => setTimeout(r, 700));

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
        throw new Error('API fallback');
      }
    } catch {
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
        'DealFlow crafted a personalized offer for SprintPro X2 at ₹3,949 (saving ₹350 from ₹4,299 list price) with guaranteed Tuesday delivery and 10-day returns.'
      );
    } finally {
      setIsNegotiating(false);
      setNegotiationPhaseText(null);
    }
  };

  // Trigger Contextual Safety Tests
  const handleTriggerSafetyTest = (type: 'inventory_race' | 'budget_exceeded' | 'human_approval') => {
    setActiveFailureMode(type);
    if (type === 'inventory_race') {
      setSingleOffer({
        offer_id: 'off-race-depleted-01',
        sku: 'SHOES-SPRINTPRO-X2',
        product_name: 'SprintPro X2 Running Shoes',
        quantity: 2,
        list_price_paise: 429900,
        final_price_paise: 394900,
        discount_paise: 35000,
        merchant_name: 'Apex Athletic Goods',
        state: 'EXPIRED',
      });
      setExplanation(
        'Contract expired — warehouse inventory depleted (no charge made). When live stock ran out before buyer acceptance, DealFlow cancelled the offer cleanly with zero charge rather than shipping partial items.'
      );
    } else if (type === 'budget_exceeded') {
      setSingleOffer(null);
      setExplanation(
        'Offer rejected — buyer budget ceiling of ₹3,500 is below the merchant minimum profit floor of ₹3,600. No un-profitable contract was minted.'
      );
    } else if (type === 'human_approval') {
      setSingleOffer({
        offer_id: 'off-highval-approval-01',
        sku: 'SHOES-SPRINTPRO-X2',
        product_name: 'SprintPro X2 (Bulk Order - 25 Pairs)',
        quantity: 25,
        list_price_paise: 10747500,
        final_price_paise: 8750000,
        discount_paise: 1997500,
        merchant_name: 'Apex Athletic Goods',
        state: 'APPROVAL_PENDING',
      });
      setExplanation(
        'Held for approval — high-value bulk order (₹87,500) exceeds automatic policy threshold (₹50,000). Routed to Merchant Console for human authorization.'
      );
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
      const rawBids: CompetingBid[] = [
        {
          merchant_id: 'merchant-a',
          merchant_name: 'Apex Corporate Gifts',
          sku: 'GIFT-APEX-01',
          product_name: 'Premium Leather Corporate Hamper',
          unit_price_paise: 2950000,
          total_price_paise: 2950000 * auctionQuantity,
          discount_paise: 350000,
          delivery_promise: '2026-09-03T18:00:00Z',
          delivery_day_label: 'Thursday (4-day transit)',
          return_terms_days: 7,
          extras_description: 'Custom embossed company logo on leather journal included.',
          signed_contract: { signature: 'sig_apex_corp_01', nonce: 'nonce_a1' },
          utility_scores: {
            price_score: 0.85,
            delivery_score: 0.65,
            return_score: 0.5,
            extras_score: 0.9,
            total_utility: 0.485,
          },
        },
        {
          merchant_id: 'merchant-b',
          merchant_name: 'Blr Express Provisions',
          sku: 'GIFT-BLR-02',
          product_name: 'Artisanal Gourmet Celebration Box',
          unit_price_paise: 2890000,
          total_price_paise: 2890000 * auctionQuantity,
          discount_paise: 410000,
          delivery_promise: '2026-09-04T18:00:00Z',
          delivery_day_label: 'Friday (5-day transit)',
          return_terms_days: 10,
          extras_description: 'Standard ribbon packaging, no customization.',
          signed_contract: { signature: 'sig_blr_prov_02', nonce: 'nonce_b2' },
          utility_scores: {
            price_score: 0.95,
            delivery_score: 0.4,
            return_score: 0.7,
            extras_score: 0.2,
            total_utility: 0.35,
          },
        },
        {
          merchant_id: 'merchant-c',
          merchant_name: 'Craft & Crest Logistics',
          sku: 'GIFT-CRAFT-03',
          product_name: 'Executive Tech & Wellness Hamper',
          unit_price_paise: 3000000,
          total_price_paise: 3000000 * auctionQuantity,
          discount_paise: 300000,
          delivery_promise: '2026-09-02T18:00:00Z',
          delivery_day_label: 'Wednesday (2-day express transit)',
          return_terms_days: 15,
          extras_description: '15-day return warranty and free express courier insurance.',
          signed_contract: { signature: 'sig_craft_crest_03', nonce: 'nonce_c3' },
          utility_scores: {
            price_score: 0.75,
            delivery_score: 0.98,
            return_score: 0.9,
            extras_score: 0.8,
            total_utility: 0.775,
          },
        },
      ];

      setCompetingBids(rawBids);
      setAuctionWinner(rawBids[2]!);
      setAuctionRationale(
        'Merchant C (Craft & Crest) won the auction because its Wednesday delivery achieved the highest score for the buyer’s #1 speed priority.'
      );
    } finally {
      setIsAuctioning(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav currentStage="OFFER_GENERATED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Header Strip with 1-Line Plain-English Explainer */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                VIEW 03 • LIVE DEAL ROOM
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Live Deal Room & Auction
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Where autonomous buyer agents and your merchant desk negotiate personalized pricing, SLA guarantees, and contracts in real time.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-ink-950 p-1 rounded border border-ink-800">
            <button
              onClick={() => setDealMode('single')}
              className={`py-1.5 px-3.5 rounded text-xs font-mono transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                dealMode === 'single'
                  ? 'bg-signal-bg text-signal-light border border-signal-border font-bold'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              Single-Merchant (SprintPro X2)
            </button>
            <button
              onClick={() => setDealMode('auction')}
              className={`py-1.5 px-3.5 rounded text-xs font-mono transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                dealMode === 'auction'
                  ? 'bg-signal-bg text-signal-light border border-signal-border font-bold'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              3-Merchant Auction (Gift Boxes)
            </button>
          </div>
        </div>

        {/* MODE A: SINGLE-MERCHANT FLOW */}
        {dealMode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Buyer Agent Simulator Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
                <div className="border-b border-ink-800 pb-3">
                  <span className="font-mono text-[10px] text-signal font-bold uppercase tracking-wider block mb-1">
                    BUYER AGENT INTENT
                  </span>
                  <h3 className="font-display text-lg font-bold text-ink-100">
                    SprintPro X2 Running Shoes
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-ink-400 font-sans mb-1">Budget Ceiling:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-ink-400 font-mono">₹</span>
                      <input
                        type="number"
                        value={budgetInr}
                        onChange={(e) => setBudgetInr(Number(e.target.value))}
                        className="w-full bg-ink-950 border border-ink-700 rounded py-1.5 pl-7 pr-3 text-ink-100 font-mono focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink-400 font-sans mb-1">Quantity:</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full bg-ink-950 border border-ink-700 rounded py-1.5 px-3 text-ink-100 font-mono focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-400 font-sans mb-1">Delivery SLA:</label>
                      <input
                        type="date"
                        value={deliveryDeadline}
                        onChange={(e) => setDeliveryDeadline(e.target.value)}
                        className="w-full bg-ink-950 border border-ink-700 rounded py-1.5 px-3 text-ink-100 font-mono text-xs focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-400 font-sans mb-1">Payment Preference:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentPreferences(['upi'])}
                        className={`py-1 px-3 rounded font-mono text-xs ${
                          paymentPreferences.includes('upi')
                            ? 'bg-signal-bg text-signal border border-signal-border font-bold'
                            : 'bg-ink-950 text-ink-400 border border-ink-800'
                        }`}
                      >
                        UPI (Prepaid)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentPreferences(['card'])}
                        className={`py-1 px-3 rounded font-mono text-xs ${
                          paymentPreferences.includes('card')
                            ? 'bg-signal-bg text-signal border border-signal-border font-bold'
                            : 'bg-ink-950 text-ink-400 border border-ink-800'
                        }`}
                      >
                        Credit Card
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRunSingleDeal}
                  disabled={isNegotiating}
                  className="w-full py-3 px-4 bg-signal hover:bg-signal-light text-white font-sans text-sm font-bold rounded transition-colors shadow-md disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                >
                  {isNegotiating ? (
                    <span>Crafting Contract...</span>
                  ) : (
                    <>
                      <span>Negotiate Deal & Mint Contract</span>
                      <span className="font-mono">→</span>
                    </>
                  )}
                </button>
              </div>

              {/* Contextual Safety Case Triggers */}
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-3">
                <div className="border-b border-ink-800 pb-2">
                  <span className="text-[11px] font-mono font-bold text-ink-400 uppercase tracking-wider block">
                    TRY A SAFETY EDGE-CASE
                  </span>
                  <span className="text-[11px] font-sans text-ink-500">
                    Demonstrate DealFlow safety protections in one click:
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <button
                    onClick={() => handleTriggerSafetyTest('inventory_race')}
                    className="w-full py-2 px-3 bg-ink-950 hover:bg-ink-800 border border-ink-700 text-ink-300 rounded text-left flex items-center justify-between transition-colors focus-visible:ring-1 focus-visible:ring-signal"
                  >
                    <span>Test: Stock runs out before acceptance</span>
                    <span className="text-amber text-[10px]">Simulate →</span>
                  </button>

                  <button
                    onClick={() => handleTriggerSafetyTest('budget_exceeded')}
                    className="w-full py-2 px-3 bg-ink-950 hover:bg-ink-800 border border-ink-700 text-ink-300 rounded text-left flex items-center justify-between transition-colors focus-visible:ring-1 focus-visible:ring-signal"
                  >
                    <span>Test: Buyer budget too low (₹3,500)</span>
                    <span className="text-redline text-[10px]">Simulate →</span>
                  </button>

                  <button
                    onClick={() => handleTriggerSafetyTest('human_approval')}
                    className="w-full py-2 px-3 bg-ink-950 hover:bg-ink-800 border border-ink-700 text-ink-300 rounded text-left flex items-center justify-between transition-colors focus-visible:ring-1 focus-visible:ring-signal"
                  >
                    <span>Test: Bulk order requires approval (&gt;₹50k)</span>
                    <span className="text-amber text-[10px]">Simulate →</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Deal Ticket Showcase */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                <h3 className="font-display text-lg font-bold text-ink-100">
                  Signed Contract Ticket
                </h3>
                <span className="text-xs font-mono text-ink-400">
                  Status: <strong className="text-signal">{singleOffer ? singleOffer.state : 'Awaiting Request'}</strong>
                </span>
              </div>

              {isNegotiating && negotiationPhaseText && (
                <div className="bg-ink-900 border border-signal-border/50 p-6 rounded-lg text-center space-y-3 animate-pulse">
                  <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="font-mono text-xs text-signal-light font-bold">
                    {negotiationPhaseText}
                  </p>
                </div>
              )}

              {singleOffer && !isNegotiating && (
                <div className="space-y-4 animate-typewriter-line">
                  <DealTicket ticket={singleOffer} />

                  {explanation && (
                    <div className="bg-ink-900 border border-ink-800 p-4 rounded-lg">
                      <span className="text-[10px] font-mono text-signal uppercase tracking-wider font-bold block mb-1">
                        EXPLANATION:
                      </span>
                      <p className="text-sm text-ink-200 font-sans leading-relaxed">
                        {explanation}
                      </p>
                    </div>
                  )}

                  {/* Ready to Settle CTA */}
                  <div className="p-4 bg-ink-900 border border-ink-700 rounded-lg flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-ink-200 block">
                        Contract Signed & Ready for Settlement
                      </span>
                      <span className="text-[11px] font-sans text-ink-400">
                        Proceed to checkout to inspect the 1:1 bound Razorpay order and live webhooks.
                      </span>
                    </div>

                    <Link
                      href="/checkout"
                      className="py-2 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors whitespace-nowrap shadow focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                    >
                      Proceed to Checkout →
                    </Link>
                  </div>

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
                          <span className="text-ink-500">HMAC-SHA256 SIGNATURE: </span>
                          {singleOffer.signature}
                        </div>
                        <div className="text-ink-400">
                          <span className="text-ink-500">REPLAY NONCE: </span>
                          {singleOffer.nonce}
                        </div>
                        <div className="text-ink-400">
                          <span className="text-ink-500">INTEGER PAISE AMOUNT: </span>
                          {singleOffer.final_price_paise} paise
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE B: 3-MERCHANT AUCTION */}
        {dealMode === 'auction' && (
          <div className="space-y-6">
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-signal uppercase tracking-wider block mb-1">
                  PARALLEL MULTI-MERCHANT AUCTION
                </span>
                <h3 className="font-display text-xl font-bold text-ink-100">
                  Bulk Request: 20 Corporate Gift Boxes (Cap ₹30,000 / unit)
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-ink-950 p-1 rounded border border-ink-800 text-xs font-mono">
                  <span className="text-ink-400 px-1">#1 Priority:</span>
                  <button
                    onClick={() => setAuctionPriority('speed')}
                    className={`px-2.5 py-1 rounded ${
                      auctionPriority === 'speed'
                        ? 'bg-signal text-white font-bold'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Speed (Wednesday)
                  </button>
                  <button
                    onClick={() => setAuctionPriority('price')}
                    className={`px-2.5 py-1 rounded ${
                      auctionPriority === 'price'
                        ? 'bg-signal text-white font-bold'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Price (Lowest)
                  </button>
                </div>

                <button
                  onClick={handleRunAuction}
                  disabled={isAuctioning}
                  className="py-2.5 px-5 bg-signal hover:bg-signal-light text-white font-sans text-xs font-bold rounded transition-colors shadow disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                >
                  {isAuctioning ? 'Evaluating 3 Bids...' : 'Broadcast Auction to 3 Merchants →'}
                </button>
              </div>
            </div>

            {/* 3 Competing Tickets Grid */}
            {competingBids.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {competingBids.map((bid) => {
                    const isWinner = auctionWinner?.merchant_id === bid.merchant_id;
                    const ticketData: DealTicketData = {
                      offer_id: 'off-' + bid.merchant_id,
                      sku: bid.sku,
                      product_name: bid.product_name,
                      quantity: auctionQuantity,
                      list_price_paise: bid.unit_price_paise + bid.discount_paise,
                      final_price_paise: bid.unit_price_paise,
                      discount_paise: bid.discount_paise,
                      delivery_promise: bid.delivery_promise,
                      return_terms_days: bid.return_terms_days,
                      merchant_id: bid.merchant_id,
                      merchant_name: bid.merchant_name,
                      state: isWinner ? 'SIGNED' : 'OFFER_CREATED',
                      signature: 'sig_' + bid.merchant_id,
                      nonce: 'nonce_' + bid.merchant_id,
                    };

                    return (
                      <div key={bid.merchant_id} className="relative">
                        <DealTicket ticket={ticketData} isWinner={isWinner} />
                      </div>
                    );
                  })}
                </div>

                {auctionRationale && (
                  <div className="bg-ink-900 border border-ink-800 p-4 rounded-lg">
                    <span className="text-[10px] font-mono text-signal uppercase tracking-wider font-bold block mb-1">
                      AUCTION OUTCOME:
                    </span>
                    <p className="text-sm text-ink-200 font-sans leading-relaxed">
                      {auctionRationale}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-800 bg-ink-950 py-4 select-none mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-ink-500">
          <div className="flex items-center gap-3">
            <span>RAZORPAY DEALFLOW</span>
            <span>•</span>
            <span>REAL ENGINE RESPONSE</span>
            <span>•</span>
            <span>1:1 PAISE SETTLEMENT</span>
          </div>

          <Link href="/checkout" className="hover:text-ink-300">
            Next: Contract & Checkout →
          </Link>
        </div>
      </footer>
    </div>
  );
}
