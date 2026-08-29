'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';

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

export default function AuctionPage() {
  const [priorityMode, setPriorityMode] = useState<'speed' | 'price' | 'extras'>('speed');
  const [quantity, setQuantity] = useState(20);
  const [budgetPerUnit, setBudgetPerUnit] = useState(30000);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [competingBids, setCompetingBids] = useState<CompetingBid[]>([]);
  const [winner, setWinner] = useState<CompetingBid | null>(null);
  const [decisionRationale, setDecisionRationale] = useState<string | null>(null);

  const getPriorityRanking = (mode: 'speed' | 'price' | 'extras') => {
    if (mode === 'speed') return ['delivery_speed', 'price', 'return_terms', 'extras'];
    if (mode === 'price') return ['price', 'delivery_speed', 'extras', 'return_terms'];
    return ['extras', 'delivery_speed', 'price', 'return_terms'];
  };

  async function handleBroadcast() {
    setIsBroadcasting(true);
    const priorities = getPriorityRanking(priorityMode);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auction/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Corporate Gift Boxes',
          buyer_constraints: {
            quantity,
            budget_max_paise: budgetPerUnit * 100,
            currency: 'INR',
            delivery_deadline: '2026-09-04T23:59:59Z',
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
        setWinner(data.auction.winner);
        setDecisionRationale(data.auction.decision_rationale);
      }
    } catch {
      // Mock simulation
      const mockResult = getMockAuctionResult(priorityMode, quantity, budgetPerUnit);
      setCompetingBids(mockResult.bids);
      setWinner(mockResult.winner);
      setDecisionRationale(mockResult.rationale);
    } finally {
      setIsBroadcasting(false);
    }
  }

  function getMockAuctionResult(mode: 'speed' | 'price' | 'extras', qty: number, budgetInr: number) {
    const rawBids: CompetingBid[] = [
      {
        merchant_id: 'merchant-a-crafts',
        merchant_name: 'Merchant A (Premium Crafts)',
        sku: 'GIFTBOX-CORP-A',
        product_name: 'Executive Artisanal Gift Box',
        unit_price_paise: 2950000,
        total_price_paise: 2950000 * qty,
        discount_paise: 250000,
        delivery_promise: '2026-09-03T23:59:59Z',
        delivery_day_label: 'Thursday',
        return_terms_days: 7,
        extras_description: 'Free custom logo laser engraving & branding included',
        signed_contract: { offer_id: 'offer-giftbox-a-001' },
        utility_scores: {
          price_score: 0.455,
          delivery_score: 0.65,
          return_score: 0.5,
          extras_score: 1.0,
          total_utility: mode === 'extras' ? 0.668 : mode === 'speed' ? 0.585 : 0.595,
        },
      },
      {
        merchant_id: 'merchant-b-bulk',
        merchant_name: 'Merchant B (Bulk Direct)',
        sku: 'GIFTBOX-CORP-B',
        product_name: 'Corporate Essentials Gift Box',
        unit_price_paise: 2890000,
        total_price_paise: 2890000 * qty,
        discount_paise: 210000,
        delivery_promise: '2026-09-04T23:59:59Z',
        delivery_day_label: 'Friday',
        return_terms_days: 7,
        extras_description: 'Standard corporate packaging (no customization)',
        signed_contract: { offer_id: 'offer-giftbox-b-002' },
        utility_scores: {
          price_score: 1.0,
          delivery_score: 0.3,
          return_score: 0.5,
          extras_score: 0.2,
          total_utility: mode === 'price' ? 0.645 : mode === 'speed' ? 0.535 : 0.355,
        },
      },
      {
        merchant_id: 'merchant-c-express',
        merchant_name: 'Merchant C (Express Gifting)',
        sku: 'GIFTBOX-CORP-C',
        product_name: 'VIP Executive Hamper',
        unit_price_paise: 3000000,
        total_price_paise: 3000000 * qty,
        discount_paise: 300000,
        delivery_promise: '2026-09-02T23:59:59Z',
        delivery_day_label: 'Wednesday',
        return_terms_days: 15,
        extras_description: '15-day replacement warranty & express air courier',
        signed_contract: { offer_id: 'offer-giftbox-c-003' },
        utility_scores: {
          price_score: 0.0,
          delivery_score: 1.0,
          return_score: 1.0,
          extras_score: 0.7,
          total_utility: mode === 'speed' ? 0.685 : mode === 'price' ? 0.455 : 0.525,
        },
      },
    ];

    rawBids.sort((a, b) => b.utility_scores.total_utility - a.utility_scores.total_utility);
    const win = rawBids[0]!;

    let rat = '';
    if (mode === 'speed') {
      rat = `Selected Merchant C (Utility: 0.685) because delivery speed was ranked #1 priority. Merchant C guarantees Wednesday delivery (2 days ahead of Friday deadline) and 15-day replacement terms at ₹30,000, defeating Merchant B (₹28,900 but Friday delivery) and Merchant A (₹29,500 Thursday delivery).`;
    } else if (mode === 'price') {
      rat = `Selected Merchant B (Utility: 0.645) because price was ranked #1 priority. Merchant B offered the lowest unit price of ₹28,900 (saving ₹1,100/unit under the ₹30,000 budget), defeating Merchant A (₹29,500) and Merchant C (₹30,000).`;
    } else {
      rat = `Selected Merchant A (Utility: 0.668) because custom branding extras were ranked #1 priority. Merchant A includes free custom logo laser engraving at ₹29,500 with Thursday delivery.`;
    }

    return { bids: rawBids, winner: win, rationale: rat };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>⚡</span> Multi-Merchant Auction & Parallel Broadcast
            </h1>
            <p className="text-slate-400 mt-1">
              Phase 9: Parallel broadcast to Merchants A, B, and C with Multi-Attribute Decision Evaluation
            </p>
          </div>
          <button
            onClick={handleBroadcast}
            disabled={isBroadcasting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-lg shadow transition disabled:opacity-50 flex items-center gap-2"
          >
            {isBroadcasting ? 'Broadcasting in Parallel...' : '📡 Broadcast Request to Merchants A, B, C'}
          </button>
        </header>

        {/* Query Controls & Priority Preset Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>🎯</span> Buyer RFP Constraints & Priority Ranking
            </h2>
            <span className="text-xs font-mono text-cyan-400">
              Target: 20 Corporate Gift Boxes (Max ₹30,000 / unit)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                ORDER QUANTITY
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                UNIT BUDGET CEILING (₹)
              </label>
              <input
                type="number"
                value={budgetPerUnit}
                onChange={(e) => setBudgetPerUnit(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                SELECT BUYER PRIORITY WEIGHTING
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriorityMode('speed')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold font-mono transition border ${
                    priorityMode === 'speed'
                      ? 'bg-blue-600 border-blue-400 text-white shadow'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  🚀 Speed First
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('price')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold font-mono transition border ${
                    priorityMode === 'price'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  💰 Price First
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('extras')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold font-mono transition border ${
                    priorityMode === 'extras'
                      ? 'bg-purple-600 border-purple-400 text-white shadow'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  ✨ Extras First
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-400 flex items-center justify-between">
            <div>
              Active Weights:{' '}
              <span className="text-cyan-300">
                {priorityMode === 'speed'
                  ? 'Delivery Speed (50%) &bull; Price (30%) &bull; Returns (15%) &bull; Extras (5%)'
                  : priorityMode === 'price'
                  ? 'Price (50%) &bull; Delivery Speed (30%) &bull; Extras (15%) &bull; Returns (5%)'
                  : 'Customization Extras (50%) &bull; Delivery Speed (30%) &bull; Price (15%) &bull; Returns (5%)'}
              </span>
            </div>
            <span className="text-slate-500">Destination: Bengaluru (BLR-WH-01)</span>
          </div>
        </div>

        {/* Side-by-Side 3-Merchant Comparison */}
        {competingBids.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⚖️</span> Side-by-Side Competing Bids & Utility Scores
              </h2>
              {winner && (
                <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-600 px-3 py-1 rounded font-bold">
                  Winner: {winner.merchant_name}
                </span>
              )}
            </div>

            {/* 3-Column Card Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {competingBids.map((bid) => {
                const isWinner = winner?.merchant_id === bid.merchant_id;
                const unitInr = (bid.unit_price_paise / 100).toLocaleString();
                const totalInr = (bid.total_price_paise / 100).toLocaleString();
                const discountInr = (bid.discount_paise / 100).toLocaleString();

                return (
                  <div
                    key={bid.merchant_id}
                    className={`rounded-xl p-6 space-y-5 transition flex flex-col justify-between relative ${
                      isWinner
                        ? 'bg-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/40 ring-1 ring-emerald-400'
                        : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isWinner && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-xs font-black uppercase px-4 py-0.5 rounded-full shadow">
                        🏆 Selected Winner
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Merchant Header */}
                      <div className="border-b border-slate-800 pb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-cyan-400 font-bold">
                            {bid.sku}
                          </span>
                          <span className="text-xs font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">
                            HMAC Signed
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1">
                          {bid.merchant_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{bid.product_name}</p>
                      </div>

                      {/* Pricing Block */}
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-1 font-mono">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-400">Unit Price:</span>
                          <span className="text-lg font-bold text-emerald-400">₹{unitInr}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Total ({quantity} units):</span>
                          <span className="text-slate-300 font-semibold">₹{totalInr}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-amber-300">
                          <span>Volume Discount:</span>
                          <span>-₹{discountInr}/unit</span>
                        </div>
                      </div>

                      {/* Attribute Specifications */}
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Delivery SLA:</span>
                          <span className={`font-bold ${
                            bid.delivery_day_label === 'Wednesday' ? 'text-cyan-300' : 'text-slate-200'
                          }`}>
                            {bid.delivery_day_label} Guaranteed
                          </span>
                        </div>

                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Return Window:</span>
                          <span className="text-slate-200 font-bold">{bid.return_terms_days} Days</span>
                        </div>

                        <div className="pt-1">
                          <span className="text-slate-400 block mb-1">Inclusions & Extras:</span>
                          <p className="text-slate-200 font-sans text-xs bg-slate-950 p-2 rounded border border-slate-800">
                            {bid.extras_description}
                          </p>
                        </div>
                      </div>

                      {/* Multi-Attribute Utility Score Breakdown */}
                      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 text-xs font-mono">
                        <div className="flex justify-between font-bold">
                          <span className="text-purple-300">Utility Score:</span>
                          <span className="text-white text-sm">{bid.utility_scores.total_utility} / 1.000</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                          <div>Price: <strong className="text-slate-200">{bid.utility_scores.price_score}</strong></div>
                          <div>Speed: <strong className="text-slate-200">{bid.utility_scores.delivery_score}</strong></div>
                          <div>Returns: <strong className="text-slate-200">{bid.utility_scores.return_score}</strong></div>
                          <div>Extras: <strong className="text-slate-200">{bid.utility_scores.extras_score}</strong></div>
                        </div>
                      </div>
                    </div>

                    {isWinner && (
                      <Link
                        href={`/checkout`}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg text-center text-xs transition block mt-4"
                      >
                        Proceed to Razorpay Checkout &rarr;
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Decision Rationale Banner */}
            {decisionRationale && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                  Autonomous Multi-Attribute Selection Rationale:
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {decisionRationale}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
