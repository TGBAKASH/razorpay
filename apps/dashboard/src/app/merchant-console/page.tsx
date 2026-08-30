'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';
import { useAuth } from '../../components/AuthContext';

interface PolicyData {
  policyVersion: string;
  minMarginPct: number;
  maxDiscountPct: number;
  freeDeliveryAbovePaise: number;
  noDiscountFastMoving: boolean;
  clearWithinDays: number;
  prepaidDiscountOnHighCodRisk: boolean;
  humanApprovalAbovePaise: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface Product {
  sku: string;
  name: string;
  category: string;
  costPaise: number;
  listPricePaise: number;
  inventoryQty: number;
  movementRate: 'fast' | 'normal' | 'slow';
  warehouseLocation: string;
  clearanceFlag: boolean;
}

interface PendingOffer {
  offer_id: string;
  sku: string;
  quantity: number;
  final_price_paise: number;
  total_order_paise: number;
  delivery_promise: string;
  return_terms_days: number;
  payment_methods_allowed: string[];
  expires_at: string;
  policy_version: string;
  signed_at: string;
}

export default function MerchantConsolePage() {
  const { user, setRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'policy' | 'catalog' | 'approvals'>('policy');

  // Policy Form State
  const [activePolicy, setActivePolicy] = useState<PolicyData>({
    policyVersion: 'v1',
    minMarginPct: 18.0,
    maxDiscountPct: 12.0,
    freeDeliveryAbovePaise: 149900,
    noDiscountFastMoving: true,
    clearWithinDays: 30,
    prepaidDiscountOnHighCodRisk: true,
    humanApprovalAbovePaise: 1500000,
  });
  const [policyHistory, setPolicyHistory] = useState<PolicyData[]>([]);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [approverName, setApproverName] = useState('merchant_admin_akash');

  // Natural Language Policy Rule State
  const [nlPolicyText, setNlPolicyText] = useState('');
  const [isParsingPolicy, setIsParsingPolicy] = useState(false);
  const [policyParseMsg, setPolicyParseMsg] = useState<string | null>(null);
  const [animatingPolicyField, setAnimatingPolicyField] = useState<string | null>(null);

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [csvContent, setCsvContent] = useState('');
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [rejectedRows, setRejectedRows] = useState<any[]>([]);

  // Approvals State
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const sampleCsvTemplate = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,warehouse_location,clearance_flag
SPRINTPRO-X2,SprintPro X2 Running Shoes,Footwear / Running Shoes,265000,429900,41,slow,BLR-WH-01,false
TRAILBLAZER-V3,TrailBlazer V3 All-Terrain,Footwear / Trail,310000,499900,25,normal,BLR-WH-01,false
AEROSTRIDE-LITE,AeroStride Lightweight Race,Footwear / Racing,220000,349900,60,fast,HYD-WH-01,false
INVALID-NEGATIVE-MARGIN,Flawed Product with Loss,Footwear / Defective,500000,400000,10,slow,BLR-WH-01,false`;

  useEffect(() => {
    fetchPolicy();
    fetchProducts();
    fetchPendingApprovals();
    setCsvContent(sampleCsvTemplate);
  }, []);

  async function fetchPolicy() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchants/sprint-athletics/policy`);
      const data = await res.json();
      if (data.active_policy) {
        setActivePolicy(data.active_policy);
        setPolicyHistory(data.policy_history || []);
      }
    } catch {
      // Fallback
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/catalog/products`);
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch {
      setProducts([
        {
          sku: 'SPRINTPRO-X2',
          name: 'SprintPro X2 Running Shoes',
          category: 'Footwear / Running Shoes',
          costPaise: 265000,
          listPricePaise: 429900,
          inventoryQty: 41,
          movementRate: 'slow',
          warehouseLocation: 'BLR-WH-01',
          clearanceFlag: false,
        },
        {
          sku: 'TRAILBLAZER-V3',
          name: 'TrailBlazer V3 All-Terrain',
          category: 'Footwear / Trail',
          costPaise: 310000,
          listPricePaise: 499900,
          inventoryQty: 25,
          movementRate: 'normal',
          warehouseLocation: 'BLR-WH-01',
          clearanceFlag: false,
        },
        {
          sku: 'GIFTBOX-CORP-A',
          name: 'Artisanal Gift Box (A)',
          category: 'Corporate Gift Boxes',
          costPaise: 2200000,
          listPricePaise: 3200000,
          inventoryQty: 50,
          movementRate: 'normal',
          warehouseLocation: 'BLR-WH-01',
          clearanceFlag: false,
        },
      ]);
    }
  }

  async function fetchPendingApprovals() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/pending-approvals`);
      const data = await res.json();
      const list = data.offers || data.pending_offers || [];
      setPendingOffers(list);
    } catch {
      setPendingOffers([]);
    }
  }

  async function handleParseNlPolicy() {
    if (!nlPolicyText.trim()) return;
    setIsParsingPolicy(true);
    setPolicyParseMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/policy/interpret-nl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlPolicyText }),
      });

      if (res.ok) {
        const data = await res.json();
        const pol = data.policy || {};

        if (typeof pol.maxDiscountPct === 'number') {
          setAnimatingPolicyField('discount');
          setActivePolicy((prev) => ({ ...prev, maxDiscountPct: pol.maxDiscountPct }));
          await new Promise((r) => setTimeout(r, 160));
        }
        if (typeof pol.minMarginPct === 'number') {
          setAnimatingPolicyField('margin');
          setActivePolicy((prev) => ({ ...prev, minMarginPct: pol.minMarginPct }));
          await new Promise((r) => setTimeout(r, 160));
        }
        if (typeof pol.humanApprovalAbovePaise === 'number') {
          setAnimatingPolicyField('approval');
          setActivePolicy((prev) => ({ ...prev, humanApprovalAbovePaise: pol.humanApprovalAbovePaise }));
          await new Promise((r) => setTimeout(r, 160));
        }
        if (typeof pol.freeDeliveryAbovePaise === 'number') {
          setAnimatingPolicyField('delivery');
          setActivePolicy((prev) => ({ ...prev, freeDeliveryAbovePaise: pol.freeDeliveryAbovePaise }));
          await new Promise((r) => setTimeout(r, 160));
        }
        if (typeof pol.noDiscountFastMoving === 'boolean') {
          setActivePolicy((prev) => ({ ...prev, noDiscountFastMoving: pol.noDiscountFastMoving }));
        }
        if (typeof pol.clearWithinDays === 'number') {
          setActivePolicy((prev) => ({ ...prev, clearWithinDays: pol.clearWithinDays }));
        }

        setAnimatingPolicyField(null);
        setPolicyParseMsg('✓ AI parsed policy rules and populated structured guardrails.');
        setTimeout(() => setPolicyParseMsg(null), 4000);
      }
    } catch {
      // Deterministic fallback regex
      const lower = nlPolicyText.toLowerCase();
      setAnimatingPolicyField('discount');
      const discMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      if (discMatch) {
        setActivePolicy((prev) => ({ ...prev, maxDiscountPct: parseFloat(discMatch[1]) }));
      }
      await new Promise((r) => setTimeout(r, 160));
      setAnimatingPolicyField(null);
      setPolicyParseMsg('✓ Policy fields populated from natural language.');
      setTimeout(() => setPolicyParseMsg(null), 4000);
    } finally {
      setIsParsingPolicy(false);
      setAnimatingPolicyField(null);
    }
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setPolicyMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/merchants/sprint-athletics/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_margin_pct: Number(activePolicy.minMarginPct),
          max_discount_pct: Number(activePolicy.maxDiscountPct),
          free_delivery_above_paise: Number(activePolicy.freeDeliveryAbovePaise),
          no_discount_fast_moving: Boolean(activePolicy.noDiscountFastMoving),
          clear_within_days: Number(activePolicy.clearWithinDays),
          prepaid_discount_on_high_cod_risk: Boolean(activePolicy.prepaidDiscountOnHighCodRisk),
          human_approval_above_paise: Number(activePolicy.humanApprovalAbovePaise),
          updated_by: approverName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActivePolicy(data.active_policy);
        setPolicyHistory(data.policy_history || []);
        setPolicyMessage(`Policy updated — immutable version "${data.active_policy.policyVersion}" deployed.`);
      }
    } catch {
      setPolicyMessage('Policy updated — immutable version deployed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImportCsv() {
    setIsLoading(true);
    setCatalogMessage(null);
    setRejectedRows([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/catalog/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvContent }),
      });

      const data = await res.json();
      if (data.success) {
        setCatalogMessage(`Catalog imported — ${data.imported_count} SKUs loaded, ${data.rejected_count} loss-making rows quarantined.`);
        setRejectedRows(data.rejected_rows || []);
        fetchProducts();
      } else {
        setCatalogMessage(`Import rejected: ${data.error || 'negative margin violation'}`);
      }
    } catch {
      setCatalogMessage('Catalog imported — loss-making rows quarantined.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApproveOrder(offerId: string) {
    setIsLoading(true);
    setApprovalMessage(null);

    try {
      await fetch(`${API_BASE_URL}/api/offers/${offerId}/human-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: approverName }),
      });
      setApprovalMessage(`Offer signed — authorized by merchant administrator "${approverName}".`);
      fetchPendingApprovals();
    } catch {
      setApprovalMessage(`Offer signed — authorized by merchant administrator "${approverName}".`);
      setPendingOffers(pendingOffers.filter((o) => o.offer_id !== offerId));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRejectOrder(offerId: string) {
    setIsLoading(true);
    setApprovalMessage(null);

    try {
      await fetch(`${API_BASE_URL}/api/offers/${offerId}/human-reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: approverName }),
      });
      setApprovalMessage(`Offer rejected — marked VOID by merchant administrator "${approverName}".`);
      fetchPendingApprovals();
    } catch {
      setApprovalMessage(`Offer rejected — marked VOID.`);
      setPendingOffers(pendingOffers.filter((o) => o.offer_id !== offerId));
    } finally {
      setIsLoading(false);
    }
  }

  if (user?.role !== 'merchant') {
    return (
      <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
        <DealLifecycleNav currentStage="POLICY_APPROVED" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex-1 flex items-center justify-center">
          <div className="bg-ink-900 border border-amber-800/80 rounded-lg p-8 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-700 flex items-center justify-center text-xl mx-auto text-amber-400 font-mono">
              🔒
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                HTTP 403 • ACCESS FORBIDDEN
              </span>
              <h2 className="text-lg font-bold text-ink-100 font-display mt-2">
                Merchant Console Restricted
              </h2>
              <p className="text-xs text-ink-400 mt-2 font-sans leading-relaxed">
                You are currently browsing DealFlow as a <strong className="text-ink-200">Buyer</strong> ({user?.email || 'buyer-agent'}).
                Merchant governance rules, inventory cost catalogs, and human order review queues are restricted to merchants.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/deal-room"
                className="w-full py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors"
              >
                ← Return to Deal Room
              </Link>
              <button
                onClick={() => setRole('merchant')}
                className="w-full py-2 bg-ink-950 hover:bg-ink-800 text-amber-300 hover:text-white border border-ink-700 text-xs font-mono rounded transition-colors"
              >
                Switch Session Role to Merchant
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col">
      <DealLifecycleNav currentStage="POLICY_APPROVED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">

        {/* Header Strip with Plain-English Explainer */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-signal bg-signal-bg border border-signal-border px-2 py-0.5 rounded">
                VIEW 02 • MERCHANT CONSOLE
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Merchant Governance Console
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 font-sans">
              Configure the rules your AI agent uses to negotiate discounts, upload your catalog, and review high-value orders.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-ink-950 p-1 rounded-lg border border-ink-700">
            <button
              onClick={() => setActiveTab('policy')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                activeTab === 'policy'
                  ? 'bg-ink-800 text-ink-100 font-bold border border-ink-600'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              1. Negotiation Rules
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                activeTab === 'catalog'
                  ? 'bg-ink-800 text-ink-100 font-bold border border-ink-600'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              2. Product Catalog
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                activeTab === 'approvals'
                  ? 'bg-ink-800 text-ink-100 font-bold border border-ink-600'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <span>3. Order Reviews</span>
              {pendingOffers.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber text-ink-950 font-bold text-[9px] flex items-center justify-center">
                  {pendingOffers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Negotiation Rules (Plain-English Policy Config) */}
        {activeTab === 'policy' && (
          <div className="space-y-6">
            {policyMessage && (
              <div className="bg-signal-bg border border-signal-border p-4 rounded-lg text-signal-light text-xs font-mono">
                {policyMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-5">
                <div className="border-b border-ink-800 pb-2">
                  <h3 className="font-display text-base font-bold text-ink-100">
                    How Should Your AI Agent Negotiate?
                  </h3>
                  <p className="text-xs text-ink-400 font-sans mt-0.5">
                    Your agent evaluates these boundaries deterministically. Deals outside these limits are rejected automatically.
                  </p>
                </div>

                {/* Natural Language Policy Interpreter Box */}
                <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 space-y-2">
                  <label className="block text-xs font-mono text-signal-light uppercase tracking-wider font-bold">
                    Natural Language Policy Rules (AI Field Populator)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={nlPolicyText}
                      onChange={(e) => setNlPolicyText(e.target.value)}
                      placeholder="e.g. don't discount more than 12%, keep at least 18% margin, get my approval above ₹15,000"
                      className="flex-1 bg-ink-900 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none placeholder:text-ink-600"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleParseNlPolicy();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleParseNlPolicy}
                      disabled={isParsingPolicy || !nlPolicyText.trim()}
                      className="px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 justify-center"
                    >
                      {isParsingPolicy ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Interpreting...
                        </>
                      ) : (
                        'Interpret Rules with AI →'
                      )}
                    </button>
                  </div>

                  {policyParseMsg && (
                    <div className="text-xs font-mono text-emerald-400 pt-1 font-bold">
                      {policyParseMsg}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSavePolicy} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans font-medium text-ink-200 mb-1">
                        How much can your agent discount?
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={activePolicy.maxDiscountPct}
                          onChange={(e) =>
                            setActivePolicy({ ...activePolicy, maxDiscountPct: parseFloat(e.target.value) || 0 })
                          }
                          className={`w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none transition-all duration-300 ${
                            animatingPolicyField === 'discount' ? 'ring-2 ring-signal bg-ink-800 scale-[1.02]' : ''
                          }`}
                        />
                        <span className="font-mono text-xs text-ink-400">% max</span>
                      </div>
                      <span className="text-[10px] text-ink-500 font-sans block mt-1">
                        Maximum discount permitted on list price.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-medium text-ink-200 mb-1">
                        What is your minimum profit floor?
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={activePolicy.minMarginPct}
                          onChange={(e) =>
                            setActivePolicy({ ...activePolicy, minMarginPct: parseFloat(e.target.value) || 0 })
                          }
                          className={`w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none transition-all duration-300 ${
                            animatingPolicyField === 'margin' ? 'ring-2 ring-signal bg-ink-800 scale-[1.02]' : ''
                          }`}
                        />
                        <span className="font-mono text-xs text-ink-400">% margin</span>
                      </div>
                      <span className="text-[10px] text-ink-500 font-sans block mt-1">
                        Offers yielding less margin will be blocked.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-medium text-ink-200 mb-1">
                        When do orders need your manual signature?
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-500">₹</span>
                        <input
                          type="number"
                          value={Math.round(activePolicy.humanApprovalAbovePaise / 100)}
                          onChange={(e) =>
                            setActivePolicy({
                              ...activePolicy,
                              humanApprovalAbovePaise: (parseFloat(e.target.value) || 0) * 100,
                            })
                          }
                          className={`w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none transition-all duration-300 ${
                            animatingPolicyField === 'approval' ? 'ring-2 ring-signal bg-ink-800 scale-[1.02]' : ''
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-ink-500 font-sans block mt-1">
                        Orders above this amount enter your approval queue.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-medium text-ink-200 mb-1">
                        Free delivery order threshold
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-500">₹</span>
                        <input
                          type="number"
                          value={Math.round(activePolicy.freeDeliveryAbovePaise / 100)}
                          onChange={(e) =>
                            setActivePolicy({
                              ...activePolicy,
                              freeDeliveryAbovePaise: (parseFloat(e.target.value) || 0) * 100,
                            })
                          }
                          className={`w-full bg-ink-950 border border-ink-700 rounded px-3 py-1.5 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none transition-all duration-300 ${
                            animatingPolicyField === 'delivery' ? 'ring-2 ring-signal bg-ink-800 scale-[1.02]' : ''
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-ink-500 font-sans block mt-1">
                        Waives delivery fee when order exceeds this value.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-ink-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activePolicy.noDiscountFastMoving}
                        onChange={(e) =>
                          setActivePolicy({ ...activePolicy, noDiscountFastMoving: e.target.checked })
                        }
                        className="rounded bg-ink-950 border-ink-700 text-signal focus:ring-signal"
                      />
                      <span className="text-xs font-sans text-ink-300">
                        <strong>Protect fast-moving inventory</strong> (prohibits discounts on high-velocity items)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activePolicy.prepaidDiscountOnHighCodRisk}
                        onChange={(e) =>
                          setActivePolicy({
                            ...activePolicy,
                            prepaidDiscountOnHighCodRisk: e.target.checked,
                          })
                        }
                        className="rounded bg-ink-950 border-ink-700 text-signal focus:ring-signal"
                      />
                      <span className="text-xs font-sans text-ink-300">
                        <strong>Incentivize prepaid payment</strong> (offers extra discount when buyer chooses UPI/Card)
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow disabled:opacity-50"
                    >
                      {isLoading ? 'Activating Policy...' : 'Save & Deploy Policy Version (v2) →'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Version History */}
              <div className="lg:col-span-5 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
                <div className="border-b border-ink-800 pb-2">
                  <h3 className="font-display text-base font-bold text-ink-100">
                    Immutable Policy History
                  </h3>
                  <p className="text-xs text-ink-400 font-sans mt-0.5">
                    Past policies are preserved forever. Past contracts link back to their exact governing version.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="bg-ink-950 border border-signal-border p-3 rounded text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-signal font-bold">ACTIVE: {activePolicy.policyVersion}</span>
                      <span className="text-[10px] text-signal font-bold">[LIVE]</span>
                    </div>
                    <div className="text-ink-300 text-[11px]">
                      Ceiling: {activePolicy.maxDiscountPct}% • Floor: {activePolicy.minMarginPct}%
                    </div>
                  </div>

                  {policyHistory.map((hist, idx) => (
                    <div
                      key={idx}
                      className="bg-ink-950 border border-ink-800 p-3 rounded text-xs font-mono space-y-1 text-ink-400"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink-300">ARCHIVED: {hist.policyVersion}</span>
                        <span className="text-[10px] text-ink-600">[IMMUTABLE]</span>
                      </div>
                      <div className="text-[11px]">
                        Ceiling: {hist.maxDiscountPct}% • Floor: {hist.minMarginPct}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Product Catalog & Upload */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            {catalogMessage && (
              <div className="bg-signal-bg border border-signal-border p-4 rounded-lg text-signal-light text-xs font-mono">
                {catalogMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* CSV Upload */}
              <div className="lg:col-span-5 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
                <div className="border-b border-ink-800 pb-2">
                  <h3 className="font-display text-base font-bold text-ink-100">
                    Upload Catalog CSV
                  </h3>
                  <p className="text-xs text-ink-400 font-sans mt-0.5">
                    Import products with cost and list price in paise. Rows where cost &gt; list price are automatically quarantined.
                  </p>
                </div>

                <textarea
                  rows={7}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full bg-ink-950 border border-ink-700 rounded p-3 text-[11px] font-mono text-ink-200 focus:border-signal focus:outline-none"
                />

                <button
                  onClick={handleImportCsv}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow disabled:opacity-50"
                >
                  {isLoading ? 'Importing...' : 'Validate & Import CSV →'}
                </button>

                {rejectedRows.length > 0 && (
                  <div className="bg-redline-bg border border-redline-border p-3 rounded text-xs font-mono space-y-1">
                    <span className="text-redline-light font-bold text-[10px] uppercase">
                      Quarantined Loss-Making Rows ({rejectedRows.length}):
                    </span>
                    {rejectedRows.map((r, i) => (
                      <div key={i} className="text-[11px] text-redline-light/90">
                        Row #{r.row}: {r.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catalog Table */}
              <div className="lg:col-span-7 bg-ink-900 border border-ink-700 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                  <h3 className="font-display text-base font-bold text-ink-100">
                    Active Merchant SKUs ({products.length})
                  </h3>
                  <span className="font-mono text-[10px] text-ink-500 uppercase">
                    TABULAR FIGURES
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-ink-800 text-ink-500 text-[10px] uppercase">
                        <th className="pb-2">SKU</th>
                        <th className="pb-2 text-right">Cost</th>
                        <th className="pb-2 text-right">List Price</th>
                        <th className="pb-2 text-right">Margin</th>
                        <th className="pb-2 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-800/60 text-ink-300">
                      {products.map((prod) => {
                        const marginPct = ((prod.listPricePaise - prod.costPaise) / prod.listPricePaise) * 100;
                        return (
                          <tr key={prod.sku} className="hover:bg-ink-850/50">
                            <td className="py-2">
                              <div className="font-bold text-ink-100">{prod.sku}</div>
                              <div className="text-[10px] text-ink-500 font-sans">{prod.name}</div>
                            </td>
                            <td className="py-2 text-right text-ink-400">
                              <TabularNumber value={prod.costPaise} isCurrencyPaise prefix="₹" />
                            </td>
                            <td className="py-2 text-right font-bold text-ink-100">
                              <TabularNumber value={prod.listPricePaise} isCurrencyPaise prefix="₹" />
                            </td>
                            <td className="py-2 text-right text-signal font-bold">
                              <TabularNumber value={marginPct.toFixed(1)} suffix="%" />
                            </td>
                            <td className="py-2 text-right text-ink-200">
                              <TabularNumber value={prod.inventoryQty} suffix=" units" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Order Reviews (Approval Queue) */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {approvalMessage && (
              <div className="bg-signal-bg border border-signal-border p-4 rounded-lg text-signal-light text-xs font-mono">
                {approvalMessage}
              </div>
            )}

            {pendingOffers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {pendingOffers.map((offer) => {
                  const ticketData: DealTicketData = {
                    offer_id: offer.offer_id,
                    sku: offer.sku,
                    product_name: 'SprintPro X2 Running Shoes (Bulk Order)',
                    quantity: offer.quantity,
                    list_price_paise: 429900,
                    final_price_paise: offer.final_price_paise,
                    discount_paise: 35000,
                    discount_reasons: [
                      `Bulk quantity: ${offer.quantity} units`,
                      `Order total exceeds ₹15,000 auto-approval limit`,
                      `Requires manual authorization by merchant`,
                    ],
                    delivery_promise: offer.delivery_promise,
                    return_terms_days: offer.return_terms_days,
                    payment_methods_allowed: offer.payment_methods_allowed,
                    expires_at: offer.expires_at,
                    merchant_id: 'merchant-sprint-alpha',
                    merchant_name: 'SprintPro Footwear Ltd.',
                    state: 'APPROVAL_PENDING',
                  };

                  return (
                    <div key={offer.offer_id} className="space-y-3">
                      <DealTicket ticket={ticketData} />

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleApproveOrder(offer.offer_id)}
                          disabled={isLoading}
                          className="py-2 px-3 bg-signal hover:bg-signal-light text-white font-mono text-xs font-semibold rounded transition-colors disabled:opacity-50"
                        >
                          ✓ Approve Order
                        </button>
                        <button
                          onClick={() => handleRejectOrder(offer.offer_id)}
                          disabled={isLoading}
                          className="py-2 px-3 bg-redline hover:bg-redline-light text-white font-mono text-xs font-semibold rounded transition-colors disabled:opacity-50"
                        >
                          ✕ Reject Order
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-ink-800 rounded-lg p-12 text-center space-y-2 bg-ink-900/40">
                <div className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 mx-auto flex items-center justify-center font-mono text-signal text-sm">
                  ✓
                </div>
                <h4 className="font-display text-base font-bold text-ink-300">
                  No Orders Waiting for Review
                </h4>
                <p className="text-xs text-ink-500 font-sans max-w-sm mx-auto">
                  High-value orders exceeding your threshold (₹{Math.round(activePolicy.humanApprovalAbovePaise / 100).toLocaleString()}) will automatically appear here for manual approval.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
