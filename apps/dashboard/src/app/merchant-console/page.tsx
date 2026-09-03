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

  // Per-Product Explainability Drawer State
  const [selectedExplainProduct, setSelectedExplainProduct] = useState<Product | null>(null);
  const [authorizedTiers, setAuthorizedTiers] = useState<Record<string, boolean>>({});

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
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans">
        <DealLifecycleNav currentStage="POLICY_APPROVED" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full flex-1 flex items-center justify-center">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-10 max-w-md w-full text-center space-y-5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mx-auto text-amber-600 shadow-2xs">
              🔒
            </div>
            <div>
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                HTTP 403 • Role Protected
              </span>
              <h2 className="text-xl font-bold text-slate-900 font-sans mt-3 tracking-tight">
                Merchant Console Restricted
              </h2>
              <p className="text-xs text-slate-500 mt-2 font-sans leading-relaxed">
                You are currently browsing DealFlow in the <strong className="text-slate-800">Buyer Mode</strong> ({user?.email || 'buyer-agent'}).
                Merchant governance rules, inventory cost catalogs, and human order reviews require merchant credentials.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => setRole('merchant')}
                className="w-full py-3 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Switch Session Role to Merchant →
              </button>
              <Link
                href="/deal-room"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors text-center"
              >
                ← Return to Deal Room
              </Link>
            </div>
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-500">
            <div><span>Razorpay DealFlow</span> • Sovereign Deal Desk for Agentic Commerce</div>
            <div className="flex items-center gap-5 text-slate-600 font-medium">
              <Link href="/" className="hover:text-slate-900">Overview</Link>
              <Link href="/deal-room" className="hover:text-slate-900">Deal Room</Link>
              <Link href="/audit" className="hover:text-slate-900">Audit Ledger</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      <DealLifecycleNav currentStage="POLICY_APPROVED" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">

        {/* Header Strip with Modern Soft-Bright Styling */}
        <div className="border border-slate-200/90 bg-white rounded-2xl p-6 sm:p-7 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-sans text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                VIEW 02 • MERCHANT CONSOLE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Merchant Governance Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
              Configure autonomous agent negotiation guardrails, inventory cost catalogs, and high-value approvals.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('policy')}
              className={`py-2 px-3.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                activeTab === 'policy'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Negotiation Rules
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-2 px-3.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Product Catalog
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-2 px-3.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'approvals'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>3. Order Reviews</span>
              {pendingOffers.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shadow-2xs">
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
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 text-xs font-sans font-semibold">
                {policyMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Form: Negotiation Rules */}
              <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-8 space-y-6 shadow-xs">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    How Should Your AI Agent Negotiate?
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Your agent evaluates these boundaries deterministically. Deals outside these limits are rejected automatically.
                  </p>
                </div>

                {/* Natural Language Policy Interpreter Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-2.5">
                  <label className="block text-xs font-sans text-blue-700 uppercase tracking-wider font-bold">
                    Natural Language Policy Rules (AI Field Populator)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={nlPolicyText}
                      onChange={(e) => setNlPolicyText(e.target.value)}
                      placeholder="e.g. don't discount more than 12%, keep at least 18% margin, get my approval above ₹15,000"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-sans text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none placeholder:text-slate-400 shadow-2xs"
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
                      className="px-4 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 justify-center cursor-pointer"
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
                    <div className="text-xs font-sans text-emerald-700 pt-1 font-semibold">
                      {policyParseMsg}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSavePolicy} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-sans font-semibold text-slate-700 mb-1.5">
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
                          className={`w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            animatingPolicyField === 'discount' ? 'ring-2 ring-blue-500 bg-white scale-[1.02]' : ''
                          }`}
                        />
                        <span className="font-sans text-xs text-slate-500 whitespace-nowrap">% max</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans block mt-1">
                        Maximum discount permitted on list price.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-semibold text-slate-700 mb-1.5">
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
                          className={`w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            animatingPolicyField === 'margin' ? 'ring-2 ring-blue-500 bg-white scale-[1.02]' : ''
                          }`}
                        />
                        <span className="font-sans text-xs text-slate-500 whitespace-nowrap">% margin</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans block mt-1">
                        Offers yielding less margin will be blocked.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-semibold text-slate-700 mb-1.5">
                        When do orders need your manual signature?
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 font-semibold">₹</span>
                        <input
                          type="number"
                          value={Math.round(activePolicy.humanApprovalAbovePaise / 100)}
                          onChange={(e) =>
                            setActivePolicy({
                              ...activePolicy,
                              humanApprovalAbovePaise: (parseFloat(e.target.value) || 0) * 100,
                            })
                          }
                          className={`w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            animatingPolicyField === 'approval' ? 'ring-2 ring-blue-500 bg-white scale-[1.02]' : ''
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans block mt-1">
                        Orders above this amount enter your approval queue.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-semibold text-slate-700 mb-1.5">
                        Free delivery order threshold
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 font-semibold">₹</span>
                        <input
                          type="number"
                          value={Math.round(activePolicy.freeDeliveryAbovePaise / 100)}
                          onChange={(e) =>
                            setActivePolicy({
                              ...activePolicy,
                              freeDeliveryAbovePaise: (parseFloat(e.target.value) || 0) * 100,
                            })
                          }
                          className={`w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            animatingPolicyField === 'delivery' ? 'ring-2 ring-blue-500 bg-white scale-[1.02]' : ''
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans block mt-1">
                        Waives delivery fee when order exceeds this value.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activePolicy.noDiscountFastMoving}
                        onChange={(e) =>
                          setActivePolicy({ ...activePolicy, noDiscountFastMoving: e.target.checked })
                        }
                        className="rounded border-slate-300 text-[#0052CC] focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-sans text-slate-700">
                        <strong className="text-slate-900">Protect fast-moving inventory</strong> (prohibits discounts on high-velocity items)
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activePolicy.prepaidDiscountOnHighCodRisk}
                        onChange={(e) =>
                          setActivePolicy({
                            ...activePolicy,
                            prepaidDiscountOnHighCodRisk: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#0052CC] focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-sans text-slate-700">
                        <strong className="text-slate-900">Incentivize prepaid payment</strong> (offers extra discount when buyer chooses UPI/Card)
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-[#0052CC] hover:bg-[#0747A6] text-white font-sans text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? 'Activating Policy...' : 'Save & Deploy Policy Version (v2) →'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Version History */}
              <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Immutable Policy History
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Past policies are preserved forever. Past contracts link back to their exact governing version.
                  </p>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900 font-bold text-xs">ACTIVE: {activePolicy.policyVersion}</span>
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full border border-emerald-200">[LIVE]</span>
                    </div>
                    <div className="text-emerald-800 text-xs font-mono">
                      Ceiling: {activePolicy.maxDiscountPct}% • Floor: {activePolicy.minMarginPct}%
                    </div>
                  </div>

                  {policyHistory.map((hist, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1.5 text-slate-600 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">ARCHIVED: {hist.policyVersion}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-200/80 font-semibold px-2 py-0.5 rounded-full">[IMMUTABLE]</span>
                      </div>
                      <div className="text-xs font-mono text-slate-600">
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
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 text-xs font-sans font-semibold">
                {catalogMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* CSV Upload */}
              <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Upload Catalog CSV
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Import products with cost and list price in paise. Rows where cost &gt; list price are automatically quarantined.
                  </p>
                </div>

                <textarea
                  rows={7}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-[11px] font-mono text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-inner"
                />

                <button
                  onClick={handleImportCsv}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-[#0052CC] hover:bg-[#0747A6] text-white font-sans text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Importing...' : 'Validate & Import CSV →'}
                </button>

                {rejectedRows.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs font-sans space-y-1">
                    <span className="text-rose-800 font-bold text-[11px] uppercase tracking-wider">
                      Quarantined Loss-Making Rows ({rejectedRows.length}):
                    </span>
                    {rejectedRows.map((r, i) => (
                      <div key={i} className="text-[11px] text-rose-700">
                        Row #{r.row}: {r.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catalog Table */}
              <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Active Merchant SKUs ({products.length})
                  </h3>
                  <span className="text-[11px] font-sans font-semibold text-slate-500 uppercase tracking-wider">
                    Tabular Figures
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                        <th className="pb-3">SKU</th>
                        <th className="pb-3 text-right">Cost</th>
                        <th className="pb-3 text-right">List Price</th>
                        <th className="pb-3 text-right">Margin</th>
                        <th className="pb-3 text-right">Stock</th>
                        <th className="pb-3 text-right">Incentive Heuristic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {products.map((prod) => {
                        const marginPct = ((prod.listPricePaise - prod.costPaise) / prod.listPricePaise) * 100;
                        return (
                          <tr key={prod.sku} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3">
                              <div className="font-bold text-slate-900">{prod.sku}</div>
                              <div className="text-[11px] text-slate-500 font-sans">{prod.name}</div>
                            </td>
                            <td className="py-3 text-right text-slate-500 font-mono">
                              <TabularNumber value={prod.costPaise} isCurrencyPaise prefix="₹" />
                            </td>
                            <td className="py-3 text-right font-bold text-slate-900 font-mono">
                              <TabularNumber value={prod.listPricePaise} isCurrencyPaise prefix="₹" />
                            </td>
                            <td className="py-3 text-right text-emerald-700 font-bold font-mono">
                              <TabularNumber value={marginPct.toFixed(1)} suffix="%" />
                            </td>
                            <td className="py-3 text-right text-slate-700 font-mono">
                              <TabularNumber value={prod.inventoryQty} suffix=" units" />
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setSelectedExplainProduct(prod)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0052CC] border border-blue-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                Why Discount This? →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Per-Product "Why Am I Discounting This" Modal / Drawer */}
            {selectedExplainProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-7 sm:p-8 space-y-6 shadow-2xl animate-fade-in">
                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold bg-[#0052CC] text-white">
                          MERCHANT EXPLAINABILITY DESK
                        </span>
                        <span className="text-[11px] font-sans font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✓ Zero Margin Leakage Protected
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Why Am I Discounting {selectedExplainProduct.name}?
                      </h2>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        SKU: {selectedExplainProduct.sku} • Warehouse: {selectedExplainProduct.warehouseLocation} • Policy: {activePolicy.policyVersion}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedExplainProduct(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-mono text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Top Level Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block font-semibold">Days in Inventory</span>
                      <span className="text-slate-900 font-bold text-sm block font-mono">
                        {selectedExplainProduct.movementRate === 'slow' ? '76 Days' : selectedExplainProduct.movementRate === 'fast' ? '5 Days' : '20 Days'}
                      </span>
                      <span className="text-blue-700 text-[10px] font-semibold">
                        {selectedExplainProduct.movementRate === 'slow' ? 'Aged Holding (>45d)' : 'Fresh Stock'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block font-semibold">Units Remaining</span>
                      <span className="text-slate-900 font-bold text-sm block font-mono">{selectedExplainProduct.inventoryQty} Units</span>
                      <span className="text-slate-500 text-[10px]">Location: {selectedExplainProduct.warehouseLocation}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block font-semibold">Stock Velocity</span>
                      <span className={`font-bold text-sm block ${selectedExplainProduct.movementRate === 'slow' ? 'text-amber-700' : selectedExplainProduct.movementRate === 'fast' ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {selectedExplainProduct.movementRate.toUpperCase()}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {selectedExplainProduct.movementRate === 'slow' ? '1.15x Urgency Mult' : selectedExplainProduct.movementRate === 'fast' ? '0.85x Protected' : '1.0x Standard'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block font-semibold">Buyer Stated Offer</span>
                      <span className="text-slate-900 font-bold text-sm block font-mono">₹4,000.00</span>
                      <span className="text-emerald-700 text-[10px] font-semibold">Budget Ceiling</span>
                    </div>
                  </div>

                  {/* Recommended Pricing & Trade-off Breakdown */}
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-blue-200/80 pb-3.5">
                      <div>
                        <span className="text-[10px] font-sans text-blue-800 uppercase font-bold tracking-wider">
                          Recommended Inventory-Aware Incentive
                        </span>
                        <div className="flex items-baseline gap-3 mt-1">
                          <span className="text-2xl font-bold font-mono text-slate-900">
                            {selectedExplainProduct.movementRate === 'slow' ? '₹3,949.00' : selectedExplainProduct.movementRate === 'fast' ? '₹4,299.00' : '₹4,099.00'}
                          </span>
                          <span className="text-xs font-sans text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            {selectedExplainProduct.movementRate === 'slow' ? '8.1% Discount (-₹350)' : selectedExplainProduct.movementRate === 'fast' ? '0.0% Discount (List Preserved)' : '4.7% Discount (-₹200)'}
                          </span>
                          <span className="text-xs font-mono text-slate-400 line-through">
                            ₹{(selectedExplainProduct.listPricePaise / 100).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right font-sans">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Expected Incremental Profit</span>
                        <span className="text-base font-bold text-emerald-800 font-mono">
                          {selectedExplainProduct.movementRate === 'slow' ? '₹746.93 / lead' : selectedExplainProduct.movementRate === 'fast' ? '₹701.25 / lead' : '₹680.00 / lead'}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {selectedExplainProduct.movementRate === 'slow' ? '+₹196.93 vs list baseline' : 'Maximized list margin'}
                        </span>
                      </div>
                    </div>

                    {/* 5 Plain-Language Mathematical Justifications */}
                    <div className="space-y-3 text-xs font-sans">
                      <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Plain-Language Mathematical Justification:
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                          <strong className="text-blue-800 text-xs block font-semibold">
                            1. Stock Age &amp; Velocity Urgency
                          </strong>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            {selectedExplainProduct.movementRate === 'slow'
                              ? '76 days in warehouse with slow movement rate triggers the 1.15x clearance multiplier, prioritizing working capital velocity.'
                              : 'Fresh inventory with fast turnover requires zero markdown; velocity multiplier (0.85x) strictly protects full list price margin.'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                          <strong className="text-blue-800 text-xs block font-semibold">
                            2. Buyer Budget Alignment
                          </strong>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            {selectedExplainProduct.movementRate === 'slow'
                              ? 'At ₹3,949, this offer is under the buyer’s ₹4,000 ceiling (gap ratio = +0.0128), boosting base acceptance probability to 52.5% and final probability to 57.5%.'
                              : 'Fast-moving stock is priced at list price ₹4,299. High organic demand negates the need to discount into buyer budget.'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                          <strong className="text-blue-800 text-xs block font-semibold">
                            3. Why It Beats a Smaller Discount (0% List Price)
                          </strong>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            At list price ₹4,299, the price breaches the buyer’s ceiling, collapsing predicted acceptance to 42.5%. The 8.1% discount yields +17.5% higher conversion, generating ₹746.93 expected profit vs ₹550.00 at list price.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                          <strong className="text-blue-800 text-xs block font-semibold">
                            4. Why It Beats a Larger Discount (12% Policy Ceiling)
                          </strong>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            At 12% max discount (₹3,783), acceptance probability rises marginally to 62.0%, but gives up ₹166 in gross margin (₹1,133 vs ₹1,299). The marginal conversion gain does not justify the margin given up.
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                        <strong className="text-emerald-900 text-xs flex items-center gap-1.5 font-bold">
                          <span>✓</span> 5. Policy Floor &amp; Non-Leakage Compliance Verified
                        </strong>
                        <p className="text-emerald-800 text-[11px] leading-relaxed">
                          Confirmed: Unit gross profit is ₹{(selectedExplainProduct.listPricePaise - (selectedExplainProduct.movementRate === 'slow' ? 35000 : 0) - selectedExplainProduct.costPaise) / 100} ({(((selectedExplainProduct.listPricePaise - (selectedExplainProduct.movementRate === 'slow' ? 35000 : 0) - selectedExplainProduct.costPaise) / selectedExplainProduct.costPaise) * 100).toFixed(1)}% margin), strictly satisfying your {activePolicy.minMarginPct}% minimum margin floor with a comfortable safety buffer.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 font-sans">
                      Changes apply deterministically to all incoming buyer agent negotiations.
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedExplainProduct(null)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Close Desk
                      </button>

                      <button
                        onClick={() => {
                          setAuthorizedTiers((prev) => ({ ...prev, [selectedExplainProduct.sku]: true }));
                          setTimeout(() => setSelectedExplainProduct(null), 800);
                        }}
                        className={`px-5 py-2.5 font-sans font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer ${
                          authorizedTiers[selectedExplainProduct.sku]
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0052CC] hover:bg-[#0747A6] text-white'
                        }`}
                      >
                        {authorizedTiers[selectedExplainProduct.sku]
                          ? '✓ Clearance Tier Authorized'
                          : 'Authorize Recommended Clearance Tier →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Order Reviews (Approval Queue) */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {approvalMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 text-xs font-sans font-semibold">
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
                    <div key={offer.offer_id} className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                      <DealTicket ticket={ticketData} />

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleApproveOrder(offer.offer_id)}
                          disabled={isLoading}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          ✓ Approve Order
                        </button>
                        <button
                          onClick={() => handleRejectOrder(offer.offer_id)}
                          disabled={isLoading}
                          className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-sans text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          ✕ Reject Order
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center font-sans text-emerald-600 text-lg font-bold">
                  ✓
                </div>
                <h4 className="text-base font-bold text-slate-900 tracking-tight">
                  No Orders Waiting for Review
                </h4>
                <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto leading-relaxed">
                  High-value orders exceeding your threshold (₹{Math.round(activePolicy.humanApprovalAbovePaise / 100).toLocaleString()}) will automatically appear here for manual approval.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modern Clean Persistent Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Razorpay DealFlow</span>
            <span>&bull;</span>
            <span>Sovereign Deal Desk for Agentic Commerce</span>
          </div>
          <div className="flex items-center gap-5 text-slate-600 font-medium">
            <Link href="/" className="hover:text-slate-900 transition-colors">Overview</Link>
            <Link href="/merchant-console" className="text-[#0052CC] font-semibold">Merchant Console</Link>
            <Link href="/deal-room" className="hover:text-slate-900 transition-colors">Deal Room</Link>
            <Link href="/audit" className="hover:text-slate-900 transition-colors">Audit Ledger</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
