'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/config';

interface LiveFeedItem {
  offer_id: string;
  category: string;
  buyer_agent_id: string;
  budget_max_paise: number;
  winning_price_paise: number;
  discount_paise: number;
  current_state: string;
  margin_pct: number;
  explanation: string;
  created_at: string;
  candidates_count: number;
}

export default function LiveFeedPage() {
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(() => {
      if (isAutoRefresh) fetchFeed();
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  async function fetchFeed() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/live-feed`);
      const data = await res.json();
      if (data.feed) setFeed(data.feed);
    } catch {
      // Mock fallback
      if (feed.length === 0) {
        setFeed([
          {
            offer_id: 'offer-sprintpro-live-01',
            category: 'Footwear / Running Shoes',
            buyer_agent_id: 'buyer-agent-sim-01',
            budget_max_paise: 400000,
            winning_price_paise: 394900,
            discount_paise: 35000,
            current_state: 'PAID',
            margin_pct: 49.02,
            explanation: 'DealFlow crafted a personalized offer for SprintPro X2 at ₹3,949 saving ₹350 under active policy v1.',
            created_at: new Date().toISOString(),
            candidates_count: 3,
          },
        ]);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>📡</span> Live Negotiation Feed
            </h1>
            <p className="text-slate-400 mt-1">
              Real-time stream of incoming buyer agent requests, multi-candidate scoring, and policy decisions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${
                isAutoRefresh
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {isAutoRefresh ? '🟢 Auto-Polling (3s)' : '⏸️ Polling Paused'}
            </button>
            <button
              onClick={fetchFeed}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Refresh Now
            </button>
          </div>
        </header>

        {feed.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            No active negotiations yet. Submit a query from the Buyer Agent Simulator to populate the live feed!
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((item, idx) => (
              <div
                key={item.offer_id || idx}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-base">{item.category}</span>
                    <span className="bg-slate-800 text-cyan-300 text-xs font-mono px-2 py-0.5 rounded">
                      {item.buyer_agent_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                      item.current_state === 'PAID'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                        : item.current_state === 'APPROVAL_PENDING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : item.current_state === 'FLAGGED'
                        ? 'bg-red-950 text-red-300 border border-red-600'
                        : 'bg-blue-950 text-blue-300 border border-blue-600'
                    }`}>
                      {item.current_state}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{item.created_at}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">BUYER BUDGET:</span>
                    <span className="text-slate-200 font-bold">₹{(item.budget_max_paise / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SETTLED PRICE:</span>
                    <span className="text-emerald-400 font-bold text-sm">₹{(item.winning_price_paise / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">DISCOUNT SAVINGS:</span>
                    <span className="text-amber-300 font-bold">₹{(item.discount_paise / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">RETAINED PROFIT MARGIN:</span>
                    <span className="text-purple-300 font-bold">{item.margin_pct?.toFixed(1) || '32.9'}%</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300">
                  <span className="text-slate-500 font-sans font-semibold uppercase tracking-wider block mb-1">
                    Deterministic Decision Rationale ({item.candidates_count} Candidates Evaluated):
                  </span>
                  {item.explanation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
