'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

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
  reliability?: {
    on_time_rate: number;
    dispute_rate: number;
    completion_rate: number;
    reliability_score: number;
    star_rating: number;
  };
  utility_scores: {
    price_score: number;
    delivery_score: number;
    return_score: number;
    extras_score: number;
    trust_score: number;
    total_utility: number;
  };
  excluded_by_floor?: boolean;
  exclusion_reason?: string;
}

export default function AuctionPage() {
  const [priorityMode, setPriorityMode] = useState<'speed' | 'price' | 'extras'>('speed');
  const [minReliabilityFloor, setMinReliabilityFloor] = useState<number>(0);
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
            delivery_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            destination_pincode: '560001',
            payment_preference: ['upi', 'card'],
            return_preference: 'flexible',
            priorities,
            min_reliability_stars: minReliabilityFloor,
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
      // Deterministic Mock fallback
      const rawBids: CompetingBid[] = [
        {
          merchant_id: 'merchant-a-crafts',
          merchant_name: 'Merchant A (Artisanal Crafts)',
          sku: 'GIFTBOX-CORP-A',
          product_name: 'Executive Gift Box (A)',
          unit_price_paise: 2950000,
          total_price_paise: 2950000 * quantity,
          discount_paise: 250000,
          delivery_promise: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Thursday',
          return_terms_days: 7,
          extras_description: 'Free custom logo laser engraving & branding included',
          signed_contract: { offer_id: 'off-a-001', signature: 'sig_a_mock_hmac' },
          reliability: {
            on_time_rate: 0.889,
            dispute_rate: 0.944,
            completion_rate: 1.0,
            reliability_score: 0.944,
            star_rating: 4.7,
          },
          utility_scores: {
            price_score: 0.455,
            delivery_score: 0.5,
            return_score: 0.0,
            extras_score: 1.0,
            trust_score: 0.944,
            total_utility: priorityMode === 'extras' ? 0.725 : 0.525,
          },
          excluded_by_floor: minReliabilityFloor > 4.7,
        },
        {
          merchant_id: 'merchant-b-bulk',
          merchant_name: 'Merchant B (Bulk Direct)',
          sku: 'GIFTBOX-CORP-B',
          product_name: 'Standard Corporate Box (B)',
          unit_price_paise: 2890000,
          total_price_paise: 2890000 * quantity,
          discount_paise: 210000,
          delivery_promise: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Friday',
          return_terms_days: 7,
          extras_description: 'Standard packaging (no custom branding)',
          signed_contract: { offer_id: 'off-b-001', signature: 'sig_b_mock_hmac' },
          reliability: {
            on_time_rate: 0.60,
            dispute_rate: 0.80,
            completion_rate: 0.80,
            reliability_score: 0.733,
            star_rating: 3.7,
          },
          utility_scores: {
            price_score: 1.0,
            delivery_score: 0.0,
            return_score: 0.0,
            extras_score: 0.0,
            trust_score: 0.733,
            total_utility: minReliabilityFloor > 3.7 ? -1.0 : (priorityMode === 'price' ? 0.82 : 0.35),
          },
          excluded_by_floor: minReliabilityFloor > 3.7,
          exclusion_reason: minReliabilityFloor > 3.7
            ? `Merchant rating (3.7★) is below buyer's required minimum reliability floor of ${minReliabilityFloor.toFixed(1)}★ (Dispute rate: 20%, On-time rate: 60%).`
            : undefined,
        },
        {
          merchant_id: 'merchant-c-express',
          merchant_name: 'Merchant C (Express Logistics)',
          sku: 'GIFTBOX-CORP-C',
          product_name: 'Priority Express Box (C)',
          unit_price_paise: 3000000,
          total_price_paise: 3000000 * quantity,
          discount_paise: 300000,
          delivery_promise: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Wednesday',
          return_terms_days: 15,
          extras_description: '15-day hassle-free replacement warranty included',
          signed_contract: { offer_id: 'off-c-001', signature: 'sig_c_mock_hmac' },
          reliability: {
            on_time_rate: 1.0,
            dispute_rate: 1.0,
            completion_rate: 1.0,
            reliability_score: 1.0,
            star_rating: 5.0,
          },
          utility_scores: {
            price_score: 0.0,
            delivery_score: 1.0,
            return_score: 1.0,
            extras_score: 0.0,
            trust_score: 1.0,
            total_utility: priorityMode === 'speed' ? 0.775 : 0.38,
          },
          excluded_by_floor: minReliabilityFloor > 5.0,
        },
      ];

      const eligibleBids = rawBids.filter((b) => !b.excluded_by_floor);
      let win = eligibleBids[0]!;
      let rat = '';

      if (priorityMode === 'speed') {
        win = eligibleBids.find((b) => b.sku === 'GIFTBOX-CORP-C') || eligibleBids[0]!;
        rat = `Merchant C selected: Delivery speed was ranked #1 priority (Wednesday air courier) with 5.0★ perfect reliability record.`;
      } else if (priorityMode === 'price') {
        if (minReliabilityFloor > 3.7) {
          win = eligibleBids.find((b) => b.sku === 'GIFTBOX-CORP-A') || eligibleBids[0]!;
          rat = `Merchant A selected (₹29,500 / 4.7★): Lowest price bidder Merchant B (₹28,900 / 3.7★) was excluded because its 3.7★ rating fell below your ${minReliabilityFloor.toFixed(1)}★ reliability floor (20% dispute rate, 40% late delivery history).`;
        } else {
          win = eligibleBids.find((b) => b.sku === 'GIFTBOX-CORP-B') || eligibleBids[0]!;
          rat = `Merchant B selected (₹28,900 / 3.7★): Price was ranked #1 priority with no reliability floor restriction.`;
        }
      } else if (priorityMode === 'extras') {
        win = eligibleBids.find((b) => b.sku === 'GIFTBOX-CORP-A') || eligibleBids[0]!;
        rat = `Merchant A selected: Customization and extras were ranked #1 priority (Free custom logo branding included) with 4.7★ reliability.`;
      }

      setCompetingBids(rawBids);
      setWinner(win);
      setDecisionRationale(rat);
    } finally {
      setIsBroadcasting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav currentStage="OFFER_GENERATED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                PHASE 02 • MULTI-MERCHANT PARALLEL BROADCAST
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              3-Merchant Multi-Attribute Auction
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              One buyer intent fans out to 3 independent merchant offer engines in parallel. Compares signed contracts on Speed, Price, Customization, and Demonstrated Reliability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-400 bg-ink-800 border border-ink-700 px-3 py-1.5 rounded">
              DECISION MODEL: RELIABILITY-WEIGHTED MAUT
            </span>
          </div>
        </div>

        {/* Control Console */}
        <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <span className="font-mono text-xs font-bold text-ink-300 uppercase">
              Buyer Agent Request Parameters
            </span>
            <span className="font-mono text-[10px] text-ink-500 uppercase">
              PARALLEL FANOUT + TRUST FLOOR
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                Requested Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                Max Budget Per Unit (₹)
              </label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-ink-500">₹</span>
                <input
                  type="number"
                  value={budgetPerUnit}
                  onChange={(e) => setBudgetPerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                Buyer Priority Weighting
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setPriorityMode('speed')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                    priorityMode === 'speed'
                      ? 'bg-signal-bg border-signal text-signal font-bold'
                      : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                  }`}
                >
                  ⚡ Speed
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('price')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                    priorityMode === 'price'
                      ? 'bg-signal-bg border-signal text-signal font-bold'
                      : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                  }`}
                >
                  💰 Price
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityMode('extras')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono uppercase border transition-colors ${
                    priorityMode === 'extras'
                      ? 'bg-signal-bg border-signal text-signal font-bold'
                      : 'bg-ink-950 border-ink-700 text-ink-400 hover:border-ink-600'
                  }`}
                >
                  ✨ Extras
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-ink-400 mb-1">
                Min. Merchant Reliability
              </label>
              <select
                value={minReliabilityFloor}
                onChange={(e) => setMinReliabilityFloor(parseFloat(e.target.value))}
                className="w-full bg-ink-950 border border-ink-700 rounded px-2.5 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
              >
                <option value={0}>No preference (All eligible)</option>
                <option value={3.0}>3.0+ Stars (Standard)</option>
                <option value={4.0}>4.0+ Stars (High Reliability)</option>
                <option value={4.5}>4.5+ Stars (Verified Elite)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleBroadcast}
            disabled={isBroadcasting}
            className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow disabled:opacity-50"
          >
            {isBroadcasting
              ? 'Broadcasting RFP to Merchants A, B, and C in Parallel...'
              : 'Broadcast RFP to All 3 Merchants Simultaneously →'}
          </button>
        </div>

        {/* Winner Decision Rationale Banner */}
        {winner && decisionRationale && (
          <div className="bg-signal-bg border border-signal-border rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-signal" />
                <span className="font-mono text-xs font-bold text-signal uppercase tracking-wider">
                  AUCTION DECISION: {winner.merchant_name} WON
                </span>
              </div>
              <span className="font-mono text-xs text-signal font-bold">
                SCORE: {winner.utility_scores.total_utility.toFixed(3)} / 1.000
              </span>
            </div>
            <p className="text-xs text-ink-200 font-sans leading-relaxed">
              {decisionRationale}
            </p>
          </div>
        )}

        {/* Side-by-Side 3 Competing Deal Tickets */}
        {competingBids.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="font-mono text-xs font-bold text-ink-300 uppercase">
                Side-by-Side Competing Merchant Deal Tickets
              </span>
              <span className="font-mono text-[10px] text-ink-500 uppercase">
                INDEPENDENTLY SIGNED CONTRACTS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {competingBids.map((bid) => {
                const isCurrentWinner = winner?.sku === bid.sku;
                const isExcluded = bid.excluded_by_floor;
                const starRating = bid.reliability?.star_rating || 4.0;
                const onTimePct = Math.round((bid.reliability?.on_time_rate || 0.9) * 100);
                const disputePct = Math.round((1 - (bid.reliability?.dispute_rate || 1.0)) * 100);

                const ticketData: DealTicketData = {
                  offer_id: bid.signed_contract?.offer_id || 'bid-' + bid.sku,
                  sku: bid.sku,
                  product_name: bid.product_name,
                  quantity,
                  list_price_paise: bid.unit_price_paise + bid.discount_paise,
                  final_price_paise: bid.unit_price_paise,
                  discount_paise: bid.discount_paise,
                  discount_reasons: [
                    bid.extras_description,
                    `Delivery: ${bid.delivery_day_label} guaranteed`,
                    `${bid.return_terms_days}-day return policy`,
                    `Reliability: ${starRating.toFixed(1)}★ (${onTimePct}% on-time, ${disputePct}% dispute)`,
                  ],
                  delivery_promise: bid.delivery_promise,
                  return_terms_days: bid.return_terms_days,
                  payment_methods_allowed: ['UPI', 'Card'],
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                  merchant_id: bid.merchant_id,
                  merchant_name: bid.merchant_name,
                  signature: bid.signed_contract?.signature || 'hmac_sha256_mock_sig_' + bid.sku,
                  nonce: 'nonce_' + bid.sku.toLowerCase(),
                  state: isCurrentWinner ? 'SIGNED' : 'OFFER_CREATED',
                };

                return (
                  <div key={bid.sku} className={`space-y-3 ${isExcluded ? 'opacity-70' : ''}`}>
                    {/* Reliability Trust Badge */}
                    <div className={`p-2.5 rounded border text-xs font-mono flex items-center justify-between ${
                      isExcluded
                        ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                        : starRating >= 4.5
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : 'bg-ink-900 border-ink-700 text-ink-200'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-bold">★ {starRating.toFixed(1)}</span>
                        <span className="text-[10px] text-ink-400">({onTimePct}% on-time | {disputePct}% disp)</span>
                      </div>
                      {isExcluded ? (
                        <span className="text-[10px] uppercase font-bold text-rose-400 px-1.5 py-0.5 bg-rose-900/60 rounded">
                          Excluded (Below Floor)
                        </span>
                      ) : starRating >= 4.8 ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-400 px-1.5 py-0.5 bg-emerald-900/60 rounded">
                          Verified Elite
                        </span>
                      ) : null}
                    </div>

                    {isExcluded && bid.exclusion_reason && (
                      <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-[10px] text-rose-200 font-mono leading-tight">
                        {bid.exclusion_reason}
                      </div>
                    )}

                    <DealTicket
                      ticket={ticketData}
                      isCompetitorBid
                      isWinner={isCurrentWinner && !isExcluded}
                      onPay={
                        isCurrentWinner && !isExcluded
                          ? () => {
                              window.location.href = `/checkout?offer_id=${ticketData.offer_id}&amount=${ticketData.final_price_paise * quantity}`;
                            }
                          : undefined
                      }
                    />

                    {/* Utility Breakdown Card */}
                    <div className="bg-ink-900 border border-ink-700 rounded p-3 text-[11px] font-mono space-y-1.5">
                      <div className="flex items-center justify-between text-ink-400 border-b border-ink-800 pb-1">
                        <span>MAUT Utility Breakdown</span>
                        <span className={`font-bold ${isExcluded ? 'text-rose-400 line-through' : 'text-ink-200'}`}>
                          {bid.utility_scores.total_utility < 0 ? '0.000 (Excluded)' : bid.utility_scores.total_utility.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-ink-500">
                        <span>Price Score:</span>
                        <span className="text-ink-300">
                          {bid.utility_scores.price_score.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-ink-500">
                        <span>Delivery SLA Score:</span>
                        <span className="text-route">
                          {bid.utility_scores.delivery_score.toFixed(3)} ({bid.delivery_day_label})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-ink-500">
                        <span>Extras & Customization:</span>
                        <span className="text-amber">
                          {bid.utility_scores.extras_score.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-ink-500">
                        <span>Trust & Reliability:</span>
                        <span className="text-emerald-400">
                          {(bid.utility_scores.trust_score || 0.85).toFixed(3)} ({starRating.toFixed(1)}★)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-ink-800 rounded-lg p-12 text-center space-y-2 bg-ink-900/40">
            <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
              ⚡
            </div>
            <h4 className="font-display text-base font-bold text-ink-300">
              Parallel Auction Standby
            </h4>
            <p className="text-xs text-ink-500 font-sans max-w-md mx-auto">
              Select buyer priorities above and click broadcast. DealFlow will fan out to Merchants A, B, and C, and display the 3 competing deal tickets side by side.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
