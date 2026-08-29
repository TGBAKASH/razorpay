'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { TabularNumber } from '../../components/TabularNumber';

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
            explanation:
              'DealFlow crafted a personalized offer for SprintPro X2 at ₹3,949 saving ₹350 under active policy v1.',
            created_at: new Date().toISOString(),
            candidates_count: 3,
          },
        ]);
      }
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Header Strip */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                TELEMETRY • REAL-TIME DEAL DESK STREAM
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Live Negotiation Feed & Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Continuous live stream of incoming buyer agent requests, deterministic scoring candidate matrices, and autonomous deal closures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                isAutoRefresh
                  ? 'bg-signal-bg text-signal-light border-signal-border font-bold'
                  : 'bg-ink-800 text-ink-400 border-ink-700'
              }`}
            >
              {isAutoRefresh ? '● Auto-Polling (3s)' : '○ Polling Paused'}
            </button>
            <button
              onClick={fetchFeed}
              className="py-1.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-200 border border-ink-600 text-xs font-mono rounded transition-colors"
            >
              ↻ Refresh Ticker
            </button>
          </div>
        </div>

        {feed.length === 0 ? (
          <div className="border border-dashed border-ink-800 rounded-lg p-12 text-center space-y-2 bg-ink-900/40">
            <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-ink-500 text-sm">
              📡
            </div>
            <h4 className="font-display text-base font-bold text-ink-300">
              Waiting for Live Deal Stream
            </h4>
            <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
              No active negotiations recorded in current session. Launch an agent from the Simulator to populate live telemetry.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((item, idx) => (
              <div
                key={item.offer_id || idx}
                className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink-100">
                      OFFER #{item.offer_id ? item.offer_id.slice(0, 8).toUpperCase() : '00000000'}
                    </span>
                    <span className="text-ink-600 font-mono">•</span>
                    <span className="text-xs text-ink-400 font-sans">{item.category}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        item.current_state === 'PAID'
                          ? 'bg-signal-bg border-signal-border text-signal-light'
                          : 'bg-amber-bg border-amber-border text-amber-light'
                      }`}
                    >
                      {item.current_state}
                    </span>
                    <span className="font-mono text-[10px] text-ink-500">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Ticker Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-ink-950 p-3 rounded border border-ink-800 text-xs font-mono">
                  <div>
                    <span className="text-ink-500 block text-[10px] uppercase">Buyer Ceiling</span>
                    <TabularNumber
                      value={item.budget_max_paise}
                      isCurrencyPaise
                      prefix="₹"
                      className="text-ink-300 font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-ink-500 block text-[10px] uppercase">Agreed Settlement</span>
                    <TabularNumber
                      value={item.winning_price_paise}
                      isCurrencyPaise
                      prefix="₹"
                      className="text-signal-light font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-ink-500 block text-[10px] uppercase">Discount Given</span>
                    <TabularNumber
                      value={item.discount_paise}
                      isCurrencyPaise
                      prefix="- ₹"
                      className="text-amber font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-ink-500 block text-[10px] uppercase">Gross Margin</span>
                    <TabularNumber
                      value={item.margin_pct.toFixed(1)}
                      suffix="%"
                      className="text-signal font-bold"
                    />
                  </div>
                </div>

                {/* Plain English Summary */}
                {item.explanation && (
                  <p className="text-xs text-ink-300 font-sans leading-relaxed">
                    {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
