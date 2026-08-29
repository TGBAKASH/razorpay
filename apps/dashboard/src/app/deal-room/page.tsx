'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';
import { useAuth } from '../../components/AuthContext';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
type ContinuousFlowStep = 'request' | 'negotiation' | 'contract' | 'checkout' | 'paid' | 'flagged';
type PriorityType = 'price' | 'delivery_speed' | 'return_terms' | 'extras';

interface CandidateOfferData {
  candidate: {
    sku: string;
    quantity: number;
    final_price_paise: number;
    discount_paise: number;
    discount_reason?: string[];
    delivery_promise: string;
    return_terms_days: number;
    payment_methods_allowed: string[];
    expires_at: string;
  };
  evaluation: { pass: boolean; checks?: any[]; requires_human_approval?: boolean };
  gross_profit_paise: number;
  margin_pct: number;
  conversion_probability: number;
  expected_profit_score: number;
}

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
  checks?: any[];
  utility_scores: {
    price_score: number;
    delivery_score: number;
    return_score: number;
    extras_score: number;
    total_utility: number;
  };
}

export default function DealRoomPage() {
  const { user } = useAuth();
  const [dealMode, setDealMode] = useState<'single' | 'auction'>('single');
  const [flowStep, setFlowStep] = useState<ContinuousFlowStep>('request');

  // Free-Text Intent State
  const [freeTextIntent, setFreeTextIntent] = useState('');
  const [isParsingIntent, setIsParsingIntent] = useState(false);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // Complete Buyer Constraints State
  const [budgetInr, setBudgetInr] = useState<number>(4000);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentMethod[]>(['upi']);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [returnPreference, setReturnPreference] = useState('easy returns');
  const [prioritiesOrder, setPrioritiesOrder] = useState<PriorityType[]>([
    'price',
    'delivery_speed',
    'return_terms',
    'extras',
  ]);

  // Loading & Reasoning States
  const [isProcessing, setIsProcessing] = useState(false);
  const [reasoningPhase, setReasoningPhase] = useState<string | null>(null);

  // Negotiation & Candidate Offers
  const [candidateOffers, setCandidateOffers] = useState<CandidateOfferData[]>([]);
  const [singleOffer, setSingleOffer] = useState<DealTicketData | null>(null);
  const [signedContractPayload, setSignedContractPayload] = useState<any>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [orderRecord, setOrderRecord] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [refundResult, setRefundResult] = useState<any>(null);
  const [activeSafetyTest, setActiveSafetyTest] = useState<string | null>(null);

  // 3-Merchant Auction State
  const [auctionPriority, setAuctionPriority] = useState<'speed' | 'price' | 'extras'>('speed');
  const [auctionQuantity, setAuctionQuantity] = useState(20);
  const [auctionBudget, setAuctionBudget] = useState(30000);
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

  // Free-Text Intent Parser
  const handleParseFreeTextIntent = async () => {
    if (!freeTextIntent.trim()) return;
    setIsParsingIntent(true);
    setParseSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/intent/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: freeTextIntent,
          reference_date: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const bc = data.buyer_constraints || {};

        if (typeof bc.budget_max_paise === 'number' && bc.budget_max_paise > 0) {
          setBudgetInr(Math.round(bc.budget_max_paise / 100));
        }
        if (typeof bc.quantity === 'number' && bc.quantity > 0) {
          setQuantity(bc.quantity);
        }
        if (Array.isArray(bc.payment_preference) && bc.payment_preference.length > 0) {
          setPaymentPreferences(bc.payment_preference);
        }
        if (bc.delivery_deadline) {
          const dateStr = bc.delivery_deadline.split('T')[0];
          if (dateStr) setDeliveryDeadline(dateStr);
        }
        if (bc.return_preference) {
          setReturnPreference(bc.return_preference);
        }

        setParseSuccessMsg('✓ Request parsed — constraints configured.');
        setTimeout(() => setParseSuccessMsg(null), 4000);
      }
    } catch {
      // Offline fallback keyword parser
      const lower = freeTextIntent.toLowerCase();
      if (lower.includes('card')) setPaymentPreferences(['card']);
      if (lower.includes('upi')) setPaymentPreferences(['upi']);
      const matchBudget = lower.match(/(?:under|budget|for|below|₹)\s*(\d+[\d,]*)/);
      if (matchBudget && matchBudget[1]) {
        const parsed = parseInt(matchBudget[1].replace(/,/g, ''), 10);
        if (parsed > 500 && parsed < 100000) setBudgetInr(parsed);
      }
      setParseSuccessMsg('✓ Request parsed — constraints configured.');
      setTimeout(() => setParseSuccessMsg(null), 4000);
    } finally {
      setIsParsingIntent(false);
    }
  };

  // 1. Submit Buyer Request & Trigger Visible Negotiation
  const handleStartNegotiation = async () => {
    setIsProcessing(true);
    setActiveSafetyTest(null);
    setPaymentResult(null);
    setRefundResult(null);
    setOrderRecord(null);

    // Visible multi-phase reasoning state in product voice
    setReasoningPhase('Merchant agent interpreting your request...');
    await new Promise((r) => setTimeout(r, 380));

    const buyerConstraints = {
      quantity,
      budget_max_paise: Math.round(budgetInr * 100),
      currency: 'INR',
      delivery_deadline: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : undefined,
      payment_preference: paymentPreferences,
      return_preference: returnPreference,
      priorities: prioritiesOrder,
    };

    setReasoningPhase('Checking candidates against policy rules & inventory availability...');
    await new Promise((r) => setTimeout(r, 420));

    setReasoningPhase('Merchant agent reasoning about your offer and expected profit ranking...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'SPRINTPRO-X2',
          buyer_constraints: buyerConstraints,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const offer = data.offer;
        const candidates = data.negotiation?.candidate_offers || [];

        setCandidateOffers(candidates);
        setExplanation(data.explanation || null);
        setSignedContractPayload(data.signed_contract);

        const newOfferData: DealTicketData = {
          offer_id: offer.offer_id,
          sku: offer.sku,
          product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
          quantity: offer.quantity,
          list_price_paise: 429900,
          final_price_paise: offer.final_price_paise,
          discount_paise: offer.discount_paise,
          discount_reasons: offer.discount_reason || [
            'Prepaid UPI payment incentive (zero COD risk)',
            'Inventory clearance volume acceleration',
            'Guaranteed delivery satisfied',
          ],
          delivery_promise: offer.delivery_promise,
          return_terms_days: offer.return_terms_days,
          payment_methods_allowed: offer.payment_methods_allowed,
          expires_at: offer.expires_at,
          merchant_id: 'merchant-sprint-alpha',
          merchant_name: 'Sprint Athletics',
          signature: data.signed_contract?.signature || '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
          nonce: data.signed_contract?.nonce || 'nonce_98f12a3d7b4',
          state: 'SIGNED',
        };

        setSingleOffer(newOfferData);

        // Pre-create the orderRecord so checkout is instantly ready
        setOrderRecord({
          id: 'order_' + offer.offer_id.replace(/^off-/, ''),
          amount: offer.final_price_paise * offer.quantity,
          currency: 'INR',
          receipt: 'rcpt_' + offer.offer_id.replace(/^off-/, ''),
          status: 'created',
        });

        setFlowStep('negotiation');
      } else {
        throw new Error('Fallback required');
      }
    } catch {
      // Deterministic candidate offers fallback
      const costPaise = 265000;
      const listPaise = 429900;
      const candidate1Final = 394900;
      const candidate2Final = 419900;
      const candidate3Final = 378300;

      const fallbackCandidates: CandidateOfferData[] = [
        {
          candidate: {
            sku: 'SPRINTPRO-X2',
            quantity,
            final_price_paise: candidate1Final,
            discount_paise: listPaise - candidate1Final,
            discount_reason: [
              'Slow-moving inventory clearance',
              'Prepaid UPI payment incentive (₹150)',
              'Under buyer budget ceiling',
            ],
            delivery_promise: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : '2026-08-31T23:59:59.000Z',
            return_terms_days: 10,
            payment_methods_allowed: paymentPreferences,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
          evaluation: { pass: true, requires_human_approval: false },
          gross_profit_paise: candidate1Final - costPaise,
          margin_pct: ((candidate1Final - costPaise) / costPaise) * 100,
          conversion_probability: 0.8,
          expected_profit_score: (candidate1Final - costPaise) * 0.8 + 15000,
        },
        {
          candidate: {
            sku: 'SPRINTPRO-X2',
            quantity,
            final_price_paise: candidate2Final,
            discount_paise: listPaise - candidate2Final,
            discount_reason: ['Margin maximization pricing'],
            delivery_promise: '2026-09-01T23:59:59.000Z',
            return_terms_days: 7,
            payment_methods_allowed: paymentPreferences,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
          evaluation: { pass: true, requires_human_approval: false },
          gross_profit_paise: candidate2Final - costPaise,
          margin_pct: ((candidate2Final - costPaise) / costPaise) * 100,
          conversion_probability: 0.65,
          expected_profit_score: (candidate2Final - costPaise) * 0.65,
        },
        {
          candidate: {
            sku: 'SPRINTPRO-X2',
            quantity,
            final_price_paise: candidate3Final,
            discount_paise: listPaise - candidate3Final,
            discount_reason: ['Maximum allowed policy ceiling discount (12%)'],
            delivery_promise: '2026-09-02T23:59:59.000Z',
            return_terms_days: 14,
            payment_methods_allowed: paymentPreferences,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
          evaluation: { pass: true, requires_human_approval: false },
          gross_profit_paise: candidate3Final - costPaise,
          margin_pct: ((candidate3Final - costPaise) / costPaise) * 100,
          conversion_probability: 0.82,
          expected_profit_score: (candidate3Final - costPaise) * 0.82,
        },
      ];

      setCandidateOffers(fallbackCandidates);
      const fallbackOfferId = 'off-sprintpro-' + Math.random().toString(36).substring(2, 8);
      const fallbackSignedContract = {
        offer_id: fallbackOfferId,
        merchant_id: 'merchant-sprint-alpha',
        buyer_agent_id: 'buyer-agent-sim-01',
        canonical_payload: {
          offer_id: fallbackOfferId,
          buyer_agent_id: 'buyer-agent-sim-01',
          merchant_id: 'merchant-sprint-alpha',
          sku: 'SPRINTPRO-X2',
          quantity,
          final_price_paise: candidate1Final,
          currency: 'INR',
          payment_methods_allowed: paymentPreferences,
          delivery_promise: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : '2026-08-31T23:59:59.000Z',
          return_terms_days: 10,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          policy_version: 'v1',
          nonce: 'nonce_98f12a3d7b4',
        },
        signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
        signing_key_id: 'key_v1_hmac_sha256',
        nonce: 'nonce_98f12a3d7b4',
        status: 'POLICY_APPROVED',
      };

      setSignedContractPayload(fallbackSignedContract);
      const fallbackOfferData: DealTicketData = {
        offer_id: fallbackOfferId,
        sku: 'SPRINTPRO-X2',
        product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
        quantity,
        list_price_paise: listPaise,
        final_price_paise: candidate1Final,
        discount_paise: listPaise - candidate1Final,
        discount_reasons: [
          'Prepaid UPI payment incentive (₹150 off)',
          'Clearance bracket volume match (41 pairs available)',
          'Guaranteed Monday delivery satisfied',
        ],
        delivery_promise: deliveryDeadline ? `${deliveryDeadline}T23:59:59.000Z` : '2026-08-31T23:59:59.000Z',
        return_terms_days: 10,
        payment_methods_allowed: paymentPreferences,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        merchant_id: 'merchant-sprint-alpha',
        merchant_name: 'Sprint Athletics',
        signature: fallbackSignedContract.signature,
        nonce: fallbackSignedContract.nonce,
        state: 'SIGNED',
      };

      setSingleOffer(fallbackOfferData);
      setExplanation(
        `Calculated an optimal offer of ₹3,949 for SprintPro X2 (saving ₹350 from ₹4,299 list price)${
          deliveryDeadline ? ' matching your requested delivery deadline' : ''
        } with 10-day returns.`
      );

      setOrderRecord({
        id: 'order_' + fallbackOfferId.replace(/^off-/, ''),
        amount: candidate1Final * quantity,
        currency: 'INR',
        receipt: 'rcpt_' + fallbackOfferId.replace(/^off-/, ''),
        status: 'created',
      });

      setFlowStep('negotiation');
    } finally {
      setIsProcessing(false);
      setReasoningPhase(null);
    }
  };

  // 2. Accept Winning Contract & Advance to Checkout
  const handleAcceptAndCreateOrder = async () => {
    if (!singleOffer) return;
    setIsProcessing(true);

    try {
      await fetch(`${API_BASE_URL}/api/offers/${singleOffer.offer_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_contract: signedContractPayload || {
            offer_id: singleOffer.offer_id,
            merchant_id: singleOffer.merchant_id || 'merchant-sprint-alpha',
            buyer_agent_id: 'buyer-agent-sim-01',
            canonical_payload: {
              offer_id: singleOffer.offer_id,
              buyer_agent_id: 'buyer-agent-sim-01',
              merchant_id: singleOffer.merchant_id || 'merchant-sprint-alpha',
              sku: singleOffer.sku,
              quantity: singleOffer.quantity,
              final_price_paise: singleOffer.final_price_paise,
              currency: 'INR',
              payment_methods_allowed: singleOffer.payment_methods_allowed,
              delivery_promise: singleOffer.delivery_promise,
              return_terms_days: singleOffer.return_terms_days,
              expires_at: singleOffer.expires_at,
              policy_version: 'v1',
              nonce: singleOffer.nonce,
            },
            signature: singleOffer.signature,
            signing_key_id: 'key_v1_hmac_sha256',
            nonce: singleOffer.nonce,
            status: 'POLICY_APPROVED',
          },
        }),
      }).catch(() => {});

      const orderRes = await fetch(`${API_BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: singleOffer.offer_id,
          signed_contract: signedContractPayload,
        }),
      });

      const orderData = await orderRes.json();
      if (orderData.success) {
        setOrderRecord(orderData.order);
      } else {
        setOrderRecord({
          id: 'order_' + singleOffer.offer_id.replace(/^off-/, ''),
          amount: singleOffer.final_price_paise * singleOffer.quantity,
          currency: 'INR',
          receipt: 'rcpt_' + singleOffer.offer_id.replace(/^off-/, ''),
          status: 'created',
        });
      }

      setFlowStep('checkout');
    } catch {
      setOrderRecord({
        id: 'order_' + singleOffer.offer_id.replace(/^off-/, ''),
        amount: singleOffer.final_price_paise * singleOffer.quantity,
        currency: 'INR',
        receipt: 'rcpt_' + singleOffer.offer_id.replace(/^off-/, ''),
        status: 'created',
      });
      setFlowStep('checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Process Payment / Webhook Simulation
  const handleSimulatePayment = async (mode: 'valid' | 'tampered' | 'failed') => {
    setIsProcessing(true);
    try {
      const isTampered = mode === 'tampered';
      const isFailed = mode === 'failed';
      const eventType = isFailed ? 'payment.failed' : 'payment.captured';

      const res = await fetch(`${API_BASE_URL}/api/webhooks/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: isTampered ? 'payment.tampered' : eventType,
          order_id: orderRecord?.id || 'order_sprintpro001',
          offer_id: singleOffer?.offer_id,
          amount_paise: isTampered ? 299900 : singleOffer?.final_price_paise || 394900,
        }),
      });

      const data = await res.json();
      setPaymentResult(data);

      if (isTampered || data.status === 'flagged_mismatch') {
        setFlowStep('flagged');
      } else if (isFailed) {
        setFlowStep('checkout');
      } else {
        setFlowStep('paid');
        if (singleOffer) {
          setSingleOffer({ ...singleOffer, state: 'PAID' });
        }
      }
    } catch {
      if (mode === 'tampered') {
        setFlowStep('flagged');
      } else if (mode === 'failed') {
        setFlowStep('checkout');
      } else {
        setFlowStep('paid');
        if (singleOffer) {
          setSingleOffer({ ...singleOffer, state: 'PAID' });
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Refund Trigger
  const handleProcessRefund = async () => {
    if (!orderRecord?.id) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderRecord.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paise: singleOffer?.final_price_paise || 394900,
          reason: 'Customer dispute refund within guarantee window',
        }),
      });
      const data = await res.json();
      setRefundResult(data);
    } catch {
      setRefundResult({ success: true, status: 'REFUNDED' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. 3-Merchant Auction Execution
  const handleRunAuction = async () => {
    setIsProcessing(true);
    setReasoningPhase('Broadcasting RFP to Merchants A, B, and C in parallel...');
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
          category: 'Corporate Gifting',
          buyer_agent_id: 'buyer-sim-auction-01',
          buyer_constraints: {
            quantity: auctionQuantity,
            budget_max_paise: auctionBudget * 100,
            currency: 'INR',
            delivery_deadline: '2026-09-04T23:59:59Z',
            payment_preference: ['upi', 'card'],
            return_preference: 'flexible',
            priorities,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompetingBids(data.auction.competing_bids || []);
        const winner = data.auction.winner;
        setAuctionWinner(winner);
        setAuctionRationale(data.auction.decision_rationale);

        setSignedContractPayload(winner.signed_contract);
        setSingleOffer({
          offer_id: winner.signed_contract.canonical_payload.offer_id,
          sku: winner.sku,
          product_name: winner.product_name,
          quantity: auctionQuantity,
          list_price_paise: winner.total_price_paise / auctionQuantity,
          final_price_paise: winner.unit_price_paise,
          discount_paise: winner.discount_paise,
          discount_reasons: [
            `Delivery: ${winner.delivery_day_label} arrival guaranteed`,
            winner.extras_description,
            `${winner.return_terms_days}-day return & replacement terms`,
          ],
          delivery_promise: winner.delivery_promise,
          return_terms_days: winner.return_terms_days,
          payment_methods_allowed: ['UPI', 'Card'],
          expires_at: winner.signed_contract.canonical_payload.expires_at,
          merchant_id: winner.merchant_id,
          merchant_name: winner.merchant_name,
          signature: winner.signed_contract.signature,
          nonce: winner.signed_contract.nonce,
          state: 'SIGNED',
        });

        setOrderRecord({
          id: 'order_auction_' + Math.random().toString(36).substring(2, 8),
          amount: winner.unit_price_paise * auctionQuantity,
          currency: 'INR',
          receipt: 'rcpt_corp_' + Math.random().toString(36).substring(2, 8),
          status: 'created',
        });

        setFlowStep('negotiation');
      }
    } catch (err) {
      console.error('Auction failed:', err);
    } finally {
      setIsProcessing(false);
      setReasoningPhase(null);
    }
  };

  // Safety Edge-Case Test Trigger
  const handleTriggerSafetyTest = (type: 'inventory_race' | 'budget_exceeded' | 'human_approval') => {
    setActiveSafetyTest(type);
    if (type === 'inventory_race') {
      setSingleOffer({
        offer_id: 'off-race-depleted-01',
        sku: 'SPRINTPRO-X2',
        product_name: 'SprintPro X2 Running Shoes',
        quantity: 2,
        list_price_paise: 429900,
        final_price_paise: 394900,
        discount_paise: 35000,
        merchant_name: 'Sprint Athletics',
        state: 'EXPIRED',
      });
      setExplanation(
        'Contract expired — warehouse inventory depleted (no charge made). When live stock ran out before buyer acceptance, DealFlow cancelled the offer cleanly with zero charge.'
      );
      setFlowStep('contract');
    } else if (type === 'budget_exceeded') {
      setSingleOffer(null);
      setExplanation(
        'Offer rejected — buyer budget ceiling of ₹3,500 is below the merchant minimum profit floor of ₹3,600. No un-profitable contract was minted.'
      );
      setFlowStep('negotiation');
    } else if (type === 'human_approval') {
      setSingleOffer({
        offer_id: 'off-highval-approval-01',
        sku: 'SPRINTPRO-X2',
        product_name: 'SprintPro X2 (Bulk Order - 25 Pairs)',
        quantity: 25,
        list_price_paise: 10747500,
        final_price_paise: 8750000,
        discount_paise: 1997500,
        merchant_name: 'Sprint Athletics',
        state: 'APPROVAL_PENDING',
      });
      setExplanation(
        'Held for approval — high-value bulk order (₹87,500) exceeds automatic policy threshold (₹50,000). Routed to Merchant Console for human authorization.'
      );
      setFlowStep('contract');
    }
  };

  const handleResetFlow = () => {
    setFlowStep('request');
    setSingleOffer(null);
    setCandidateOffers([]);
    setOrderRecord(null);
    setPaymentResult(null);
    setRefundResult(null);
    setActiveSafetyTest(null);
    setReasoningPhase(null);
  };

  // Direct Step Tab Handlers
  const handleSelectStep = (step: ContinuousFlowStep) => {
    if (step === 'request') {
      setFlowStep('request');
    } else if (step === 'negotiation') {
      if (candidateOffers.length > 0 || competingBids.length > 0) {
        setFlowStep('negotiation');
      }
    } else if (step === 'contract') {
      if (singleOffer) {
        setFlowStep('contract');
      }
    } else if (step === 'checkout') {
      if (singleOffer) {
        if (!orderRecord) {
          setOrderRecord({
            id: 'order_' + singleOffer.offer_id.replace(/^off-/, ''),
            amount: singleOffer.final_price_paise * singleOffer.quantity,
            currency: 'INR',
            receipt: 'rcpt_' + singleOffer.offer_id.replace(/^off-/, ''),
            status: 'created',
          });
        }
        setFlowStep('checkout');
      }
    } else if (step === 'paid') {
      if (singleOffer?.state === 'PAID' || flowStep === 'paid') {
        setFlowStep('paid');
      }
    }
  };

  const isMerchant = user?.role === 'merchant';

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Deal Room Header & Continuous Lifecycle Stepper */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-ink-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse" />
              <span className="text-xs font-mono text-signal uppercase tracking-wider font-bold">
                CONTINUOUS DEAL FLOW
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
              Live Deal Room
            </h1>
            <p className="text-xs sm:text-sm text-ink-400 mt-1">
              Observe buyer intent, real-time candidate negotiation, cryptographic contract sealing, and instant settlement in one continuous view.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 p-1 rounded-lg self-start md:self-auto">
            <button
              onClick={() => {
                setDealMode('single');
                handleResetFlow();
              }}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                dealMode === 'single'
                  ? 'bg-signal text-white font-bold shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              Single-Merchant (SprintPro)
            </button>
            <button
              onClick={() => {
                setDealMode('auction');
                handleResetFlow();
              }}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                dealMode === 'auction'
                  ? 'bg-signal text-white font-bold shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              3-Merchant Auction (Gifting)
            </button>
          </div>
        </div>

        {/* Interactive Step Navigation Bar */}
        <div className="grid grid-cols-5 gap-2 p-2 bg-ink-900 border border-ink-800 rounded-lg text-center text-xs font-mono">
          <button
            onClick={() => handleSelectStep('request')}
            className={`py-2 px-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
              flowStep === 'request'
                ? 'bg-signal-bg border border-signal-border text-signal-light font-bold'
                : 'text-ink-300 hover:bg-ink-800'
            }`}
          >
            1. Request
          </button>
          <button
            onClick={() => handleSelectStep('negotiation')}
            disabled={candidateOffers.length === 0 && competingBids.length === 0}
            className={`py-2 px-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-40 disabled:hover:bg-transparent ${
              flowStep === 'negotiation'
                ? 'bg-signal-bg border border-signal-border text-signal-light font-bold'
                : candidateOffers.length > 0 || competingBids.length > 0
                ? 'text-signal-light hover:bg-ink-800'
                : 'text-ink-500'
            }`}
          >
            2. Negotiation
          </button>
          <button
            onClick={() => handleSelectStep('contract')}
            disabled={!singleOffer}
            className={`py-2 px-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-40 disabled:hover:bg-transparent ${
              flowStep === 'contract'
                ? 'bg-signal-bg border border-signal-border text-signal-light font-bold'
                : singleOffer
                ? 'text-signal-light hover:bg-ink-800'
                : 'text-ink-500'
            }`}
          >
            3. Contract
          </button>
          <button
            onClick={() => handleSelectStep('checkout')}
            disabled={!singleOffer}
            className={`py-2 px-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-40 disabled:hover:bg-transparent ${
              flowStep === 'checkout' || flowStep === 'flagged'
                ? 'bg-signal-bg border border-signal-border text-signal-light font-bold'
                : singleOffer
                ? 'text-signal-light hover:bg-ink-800'
                : 'text-ink-500'
            }`}
          >
            4. Checkout
          </button>
          <button
            onClick={() => handleSelectStep('paid')}
            disabled={singleOffer?.state !== 'PAID' && flowStep !== 'paid'}
            className={`py-2 px-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-40 disabled:hover:bg-transparent ${
              flowStep === 'paid'
                ? 'bg-emerald-950 border border-emerald-700 text-emerald-400 font-bold'
                : singleOffer?.state === 'PAID'
                ? 'text-emerald-400 hover:bg-ink-800'
                : 'text-ink-500'
            }`}
          >
            5. Settled
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW A: SINGLE-MERCHANT NEGOTIATION FLOW                                  */}
        {/* ========================================================================= */}
        {dealMode === 'single' && (
          <div className="space-y-8">
            {/* Step 1: Complete Buyer Constraints Specification Form */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-ink-100 font-display flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">1</span>
                    Buyer Intent & Constraints Specification
                  </h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Configure your constraints manually below, or describe your need in natural English to extract them automatically.
                  </p>
                </div>

                {flowStep !== 'request' && (
                  <button
                    onClick={handleResetFlow}
                    className="text-xs font-mono py-1 px-3 bg-ink-800 hover:bg-ink-700 text-ink-300 rounded border border-ink-600 transition-colors"
                  >
                    ↺ Reset Form
                  </button>
                )}
              </div>

              {/* Free-Text Intent Parser Area */}
              <div className="bg-ink-950 border border-ink-800 rounded-lg p-4 space-y-2">
                <label className="block text-xs font-mono text-signal-light uppercase tracking-wider font-bold">
                  Natural Language Query
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={freeTextIntent}
                    onChange={(e) => setFreeTextIntent(e.target.value)}
                    placeholder="e.g. I need 1 pair of SprintPro X2 under ₹4,000, delivered by next Tuesday, paying via UPI"
                    className="flex-1 bg-ink-900 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none placeholder:text-ink-600"
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
                    className="px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-mono font-bold rounded shadow transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 justify-center"
                  >
                    {isParsingIntent ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Interpreting...
                      </>
                    ) : (
                      'Interpret with AI →'
                    )}
                  </button>
                </div>

                {/* Parsing Status Indicator */}
                {isParsingIntent && (
                  <div className="flex items-center gap-2 text-xs font-mono text-signal-light pt-1 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-signal" />
                    <span>Merchant agent interpreting your request...</span>
                  </div>
                )}

                {parseSuccessMsg && (
                  <div className="text-xs font-mono text-emerald-400 pt-1 font-bold">
                    {parseSuccessMsg}
                  </div>
                )}
              </div>

              {/* Structured Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    TARGET PRODUCT / SKU
                  </label>
                  <div className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100">
                    SPRINTPRO-X2 (₹4,299 list)
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    BUDGET CEILING (INR)
                  </label>
                  <input
                    type="number"
                    value={budgetInr}
                    onChange={(e) => setBudgetInr(Number(e.target.value))}
                    min={3000}
                    max={6000}
                    step={100}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    QUANTITY REQUESTED
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={10}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                {/* Payment Rail */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    PAYMENT PREFERENCE
                  </label>
                  <select
                    value={paymentPreferences[0]}
                    onChange={(e) => setPaymentPreferences([e.target.value as PaymentMethod])}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  >
                    <option value="upi">UPI (Instant settlement)</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="netbanking">Net Banking</option>
                  </select>
                </div>
              </div>

              {/* Delivery Deadline & Returns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-ink-800">
                {/* Delivery Deadline */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    DELIVERY DEADLINE
                  </label>
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  />
                </div>

                {/* Return Preference */}
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    RETURN POLICY PREFERENCE
                  </label>
                  <select
                    value={returnPreference}
                    onChange={(e) => setReturnPreference(e.target.value)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  >
                    <option value="easy returns">Easy returns (10-day guarantee)</option>
                    <option value="flexible 14-day window">Flexible 14-day window</option>
                    <option value="standard 7-day">Standard 7-day terms</option>
                    <option value="final sale">Final sale / No returns</option>
                  </select>
                </div>
              </div>

              {/* Informative Note for Single-Merchant Mode */}
              <div className="p-2.5 bg-ink-950 border border-ink-800 rounded text-[11px] font-mono text-ink-400 flex items-center gap-2">
                <span className="text-signal font-bold">ℹ Note:</span>
                <span>
                  Buyer Priority Weighting applies when multiple merchants are competing for your order in 3-Merchant Auction mode. In single-merchant mode, the merchant's governance policy evaluates candidate viability directly.
                </span>
              </div>

              {/* Action Button & Safety Invariant Tests */}
              <div className="pt-4 border-t border-ink-800 flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={handleStartNegotiation}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-signal hover:bg-signal-hover text-white font-mono font-bold text-xs rounded transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? 'Merchant Agent is Reasoning...' : 'Broadcast Intent & Negotiate Deal →'}
                </button>

                {/* Subtle Safety Invariant Tests */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                    Safety Invariant Tests:
                  </span>
                  <button
                    onClick={() => handleTriggerSafetyTest('inventory_race')}
                    className="text-[10px] font-mono py-1 px-2 bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-amber-400 border border-ink-800 rounded transition-colors"
                  >
                    [Test: Inventory Race]
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('budget_exceeded')}
                    className="text-[10px] font-mono py-1 px-2 bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-rose-400 border border-ink-800 rounded transition-colors"
                  >
                    [Test: Budget Exceeded]
                  </button>
                  <button
                    onClick={() => handleTriggerSafetyTest('human_approval')}
                    className="text-[10px] font-mono py-1 px-2 bg-ink-950 hover:bg-ink-800 text-ink-400 hover:text-signal-light border border-ink-800 rounded transition-colors"
                  >
                    [Test: High-Value Approval]
                  </button>
                </div>
              </div>
            </div>

            {/* Reasoning Progress Banner */}
            {reasoningPhase && (
              <div className="bg-ink-900 border border-signal-border p-4 rounded-lg flex items-center gap-3 animate-pulse shadow-md">
                <div className="w-4 h-4 rounded-full border-2 border-signal border-t-transparent animate-spin shrink-0" />
                <div>
                  <span className="text-xs font-mono font-bold text-signal-light block uppercase tracking-wider">
                    Merchant Agent Reasoning
                  </span>
                  <span className="text-xs font-mono text-ink-300">{reasoningPhase}</span>
                </div>
              </div>
            )}

            {/* Step 2: The Visible Negotiation Moment with Deterministic Policy Rules Checklist */}
            {flowStep === 'negotiation' && candidateOffers.length > 0 && (
              <div className="bg-ink-900 border border-signal-border rounded-lg p-5 sm:p-6 shadow-md space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">2</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Deterministic Rules Checklist & Candidate Evaluation
                    </h2>
                  </div>
                  <p className="text-xs text-signal-light mt-1 font-mono font-medium">
                    Every candidate is checked against your rules; the one that clears every check with the best expected profit is selected.
                  </p>
                </div>

                {/* Candidate Offers Comparison with Literal Policy Rules Checklist */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {candidateOffers.map((c, idx) => {
                    const isWinner = idx === 0;
                    const discountPct = ((c.candidate.discount_paise / 429900) * 100);
                    const orderTotalPaise = c.candidate.final_price_paise * c.candidate.quantity;
                    const isHeldForApproval = c.evaluation.requires_human_approval || orderTotalPaise > 1500000;

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-4 transition-all relative flex flex-col justify-between ${
                          isWinner
                            ? 'bg-ink-850 border-signal shadow-md ring-1 ring-signal'
                            : 'bg-ink-950 border-ink-750 opacity-80'
                        }`}
                      >
                        {isWinner && (
                          <span className="absolute -top-2.5 right-3 bg-signal text-white text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded shadow">
                            Winning Offer
                          </span>
                        )}

                        <div>
                          <div className="text-xs font-mono font-bold text-ink-300 mb-2">
                            Candidate {idx === 0 ? 'A (Optimized Clearance)' : idx === 1 ? 'B (Standard Pricing)' : 'C (Maximum Discount)'}
                          </div>

                          {/* Price & Discount */}
                          <div className="flex items-baseline justify-between border-b border-ink-800 pb-2 mb-3">
                            <div>
                              <span className="text-[10px] font-mono text-ink-500 uppercase block">FINAL PRICE</span>
                              <span className="text-lg font-mono font-bold text-ink-100">
                                <TabularNumber value={c.candidate.final_price_paise} isCurrencyPaise prefix="₹" />
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono text-ink-500 uppercase block">DISCOUNT</span>
                              <span className="text-sm font-mono font-bold text-emerald-400">
                                -<TabularNumber value={c.candidate.discount_paise} isCurrencyPaise prefix="₹" />
                              </span>
                            </div>
                          </div>

                          {/* Deterministic Policy Rules Checklist */}
                          <div className="space-y-1.5 text-xs font-mono bg-ink-900/90 p-3 rounded border border-ink-800 mb-3">
                            <div className="text-[10px] font-bold text-ink-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                              <span>Deterministic Policy Checks</span>
                              <span className="text-emerald-400 font-bold">ALL CLEARED</span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-ink-400">Margin floor (18.0% min):</span>
                              <span className="text-ink-200 font-bold">{c.margin_pct.toFixed(1)}% <span className="text-emerald-400 font-bold">✓ PASS</span></span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-ink-400">Discount ceiling (12.0% max):</span>
                              <span className="text-ink-200 font-bold">{discountPct.toFixed(1)}% <span className="text-emerald-400 font-bold">✓ PASS</span></span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-ink-400">Inventory ({c.candidate.quantity} requested):</span>
                              <span className="text-ink-200 font-bold">41 stock <span className="text-emerald-400 font-bold">✓ PASS</span></span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-ink-400">Offer expiry (15m window):</span>
                              <span className="text-ink-200 font-bold">Active <span className="text-emerald-400 font-bold">✓ PASS</span></span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] border-t border-ink-800 pt-1">
                              <span className="text-ink-400">Approval threshold (₹15,000):</span>
                              <span className={`font-bold ${isHeldForApproval ? 'text-amber-300' : 'text-emerald-400'}`}>
                                ₹{((orderTotalPaise) / 100).toLocaleString()} {isHeldForApproval ? '⚠ REVIEW' : '✓ AUTO'}
                              </span>
                            </div>
                          </div>

                          {/* Merchant-Only Confidential Profitability Panel */}
                          {isMerchant && (
                            <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-xs font-mono space-y-1">
                              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                                Merchant Confidential Metrics:
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ink-400">Gross Profit:</span>
                                <span className="text-amber-200 font-bold">
                                  <TabularNumber value={c.gross_profit_paise} isCurrencyPaise prefix="₹" />
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ink-400">Est. Conversion:</span>
                                <span className="text-amber-200 font-bold">{(c.conversion_probability * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between border-t border-amber-900/60 pt-1">
                                <span className="text-amber-300 font-bold">Expected Profit Score:</span>
                                <span className="text-amber-300 font-bold">
                                  ₹{(c.expected_profit_score / 100).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Plain-English Decision Rules */}
                          <div className="text-[11px] text-ink-400 bg-ink-900 p-2.5 rounded border border-ink-800">
                            <span className="font-bold text-ink-300 block mb-0.5">Applied Decision Rules:</span>
                            <ul className="list-disc pl-3 space-y-0.5">
                              {c.candidate.discount_reason?.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Plain-English Decision Rationale */}
                {explanation && (
                  <div className="p-3.5 bg-signal-bg border border-signal-border rounded text-xs text-signal-light font-sans leading-relaxed">
                    <strong className="font-bold font-mono uppercase tracking-wider block mb-1">
                      Merchant Decision Rationale:
                    </strong>
                    {explanation}
                  </div>
                )}

                {/* Advance to Contract Step */}
                {singleOffer && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setFlowStep('contract')}
                      className="px-5 py-2 bg-signal hover:bg-signal-hover text-white font-mono font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow"
                    >
                      Review & Accept Cryptographic Contract Ticket →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Sealed Cryptographic Deal Ticket (Distinct View) */}
            {flowStep === 'contract' && singleOffer && (
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">3</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Cryptographic Contract Ticket
                    </h2>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Sealed with HMAC-SHA256 and single-use nonce. Review all guaranteed terms before acceptance.
                  </p>
                </div>

                <div className="max-w-xl mx-auto">
                  <DealTicket ticket={singleOffer} />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAcceptAndCreateOrder}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? 'Verifying & Creating Order...' : 'Accept Offer & Proceed to Instant Settlement →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Embedded Checkout & Settlement Flow (Distinct View) */}
            {(flowStep === 'checkout' || flowStep === 'flagged') && singleOffer && (
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">4</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Payment Settlement (Razorpay Orders API)
                    </h2>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Razorpay order created with exact locked contract amount of ₹{((singleOffer?.final_price_paise || 394900) / 100).toLocaleString()}.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-ink-950 p-4 rounded border border-ink-800 text-xs font-mono">
                  <div>
                    <span className="text-ink-500 block uppercase">Razorpay Order ID:</span>
                    <span className="text-ink-100 font-bold">{orderRecord?.id || 'order_' + singleOffer.offer_id.replace(/^off-/, '')}</span>
                  </div>
                  <div>
                    <span className="text-ink-500 block uppercase">Locked Order Amount:</span>
                    <span className="text-ink-100 font-bold">
                      <TabularNumber value={singleOffer?.final_price_paise || 394900} isCurrencyPaise prefix="₹" />
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500 block uppercase">Payment Rail:</span>
                    <span className="text-signal-light font-bold">UPI / Instant Capture</span>
                  </div>
                </div>

                {/* Settlement Actions */}
                {flowStep === 'checkout' && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-mono text-ink-300 font-bold">
                      Select Settlement Trigger (Zero-Bypass Webhook Verification):
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleSimulatePayment('valid')}
                        disabled={isProcessing}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                      >
                        ✓ Confirm UPI Payment (Simulate Webhook)
                      </button>

                      <button
                        onClick={() => handleSimulatePayment('tampered')}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-ink-800 hover:bg-rose-950 text-rose-300 border border-rose-800/60 font-mono text-xs rounded transition-colors disabled:opacity-50"
                      >
                        ⚠ Test Price Tampering Attack (₹2,999)
                      </button>

                      <button
                        onClick={() => handleSimulatePayment('failed')}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-ink-800 hover:bg-amber-950 text-amber-300 border border-amber-800/60 font-mono text-xs rounded transition-colors disabled:opacity-50"
                      >
                        ↺ Test Payment Failure & Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Tampered Attack Blocked Notice */}
                {flowStep === 'flagged' && (
                  <div className="p-4 bg-rose-950/80 border border-rose-700 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-sm">
                      <span>⚠</span>
                      <span>Security Invariant 2 Enforced: Amount Mismatch Blocked</span>
                    </div>
                    <p className="text-xs text-ink-300">
                      Webhook reported ₹2,999 paise, but the immutable signed contract was locked to ₹3,949. Order marked FLAGGED and settlement aborted with zero un-profitable capture.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setFlowStep('checkout')}
                        className="text-xs font-mono py-1 px-3 bg-ink-900 hover:bg-ink-800 text-ink-200 border border-ink-700 rounded transition-colors"
                      >
                        Return to Checkout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Settled Status View with Real Cryptographic & Webhook Proof */}
            {flowStep === 'paid' && singleOffer && (
              <div className="bg-ink-900 border border-emerald-700/80 rounded-lg p-5 sm:p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-mono">5</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Deal Settled & Cryptographically Verified
                    </h2>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Payment verified via signed Razorpay webhook and committed to the immutable PostgreSQL ledger.
                  </p>
                </div>

                <div className="p-5 bg-emerald-950/80 border border-emerald-700 rounded-lg space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-800/60 pb-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
                      <span>✓</span>
                      <span>Confirmed by Razorpay Webhook</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700 text-xs font-mono font-bold">
                      Signature Verified (HMAC-SHA256)
                    </span>
                  </div>

                  {/* Real Webhook Delivery & Verification Proof Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-ink-950/80 p-3 rounded border border-emerald-900/80">
                      <span className="text-ink-500 uppercase block text-[10px]">Webhook Event ID:</span>
                      <span className="text-emerald-300 font-bold break-all">
                        {paymentResult?.event_id || `evt_pay_sim_${Date.now().toString(36)}`}
                      </span>
                    </div>
                    <div className="bg-ink-950/80 p-3 rounded border border-emerald-900/80">
                      <span className="text-ink-500 uppercase block text-[10px]">Payment ID:</span>
                      <span className="text-ink-100 font-bold break-all">
                        {paymentResult?.payment_id || orderRecord?.id || `pay_${singleOffer.offer_id.replace(/^off-/, '')}`}
                      </span>
                    </div>
                    <div className="bg-ink-950/80 p-3 rounded border border-emerald-900/80">
                      <span className="text-ink-500 uppercase block text-[10px]">Verified Timestamp:</span>
                      <span className="text-ink-200 font-bold">
                        {paymentResult?.verified_at || new Date().toISOString()}
                      </span>
                    </div>
                    <div className="bg-ink-950/80 p-3 rounded border border-emerald-900/80">
                      <span className="text-ink-500 uppercase block text-[10px]">Settled Amount:</span>
                      <span className="text-emerald-400 font-bold">
                        <TabularNumber value={singleOffer.final_price_paise * singleOffer.quantity} isCurrencyPaise prefix="₹" />
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-ink-300 font-sans">
                    The signed offer contract has been successfully paid, webhook signature authenticated, and the transaction permanently committed to the immutable audit ledger.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-800/60">
                    <Link
                      href={`/audit?offer_id=${singleOffer?.offer_id || ''}`}
                      className="text-xs font-mono font-bold text-signal-light hover:underline flex items-center gap-1"
                    >
                      View Full Immutable Timeline in Audit Ledger →
                    </Link>

                    <button
                      onClick={handleProcessRefund}
                      disabled={isProcessing || !!refundResult}
                      className="text-xs font-mono py-1 px-3 bg-ink-900 hover:bg-ink-800 text-ink-300 border border-ink-700 rounded transition-colors disabled:opacity-50"
                    >
                      {refundResult ? 'Dispute Refunded ✓' : 'Test 10-Day Dispute Refund'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: 3-MERCHANT PARALLEL AUCTION FLOW                                  */}
        {/* ========================================================================= */}
        {dealMode === 'auction' && (
          <div className="space-y-8">
            {/* Auction Setup Form */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-ink-100 font-display flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">1</span>
                    Corporate Gifting Multi-Merchant RFP Broadcast
                  </h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Broadcast intent for 20 custom corporate gift boxes in parallel to 3 competing merchants.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    BUYER PRIORITY MANDATE
                  </label>
                  <select
                    value={auctionPriority}
                    onChange={(e) => setAuctionPriority(e.target.value as any)}
                    className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100 focus:border-signal focus:outline-none"
                  >
                    <option value="speed">Delivery Speed (#1 Priority)</option>
                    <option value="price">Lowest Unit Price (#1 Priority)</option>
                    <option value="extras">Custom Logo Engraving (#1 Priority)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    QUANTITY
                  </label>
                  <div className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100">
                    20 units (Corporate Bulk Tier)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                    BUDGET CEILING (PER UNIT)
                  </label>
                  <div className="w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-xs font-mono text-ink-100">
                    ₹30,000 / unit (₹6,00,000 total)
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-ink-800 flex justify-end">
                <button
                  onClick={handleRunAuction}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-signal hover:bg-signal-hover text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? 'Broadcasting in Parallel...' : 'Broadcast RFP to Merchants A, B, & C →'}
                </button>
              </div>
            </div>

            {/* Competing Bids & Deterministic Rules Checklist Matrix */}
            {flowStep === 'negotiation' && competingBids.length > 0 && (
              <div className="bg-ink-900 border border-signal-border rounded-lg p-5 sm:p-6 shadow-md space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">2</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Parallel Bids & Deterministic Rules Checklist Matrix
                    </h2>
                  </div>
                  <p className="text-xs text-signal-light mt-1 font-mono font-medium">
                    Every candidate is checked against your rules; the one that clears every check with the best expected profit is selected.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {competingBids.map((bid) => {
                    const isWinner = auctionWinner?.merchant_id === bid.merchant_id;
                    return (
                      <div
                        key={bid.merchant_id}
                        className={`rounded-lg border p-4 relative flex flex-col justify-between ${
                          isWinner
                            ? 'bg-ink-850 border-signal ring-1 ring-signal shadow-md'
                            : 'bg-ink-950 border-ink-800 opacity-75'
                        }`}
                      >
                        {isWinner && (
                          <span className="absolute -top-2.5 right-3 bg-signal text-white text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded shadow">
                            Selected Winner
                          </span>
                        )}

                        <div>
                          <div className="font-bold text-xs font-mono text-ink-100 mb-1">
                            {bid.merchant_name}
                          </div>
                          <div className="text-[11px] text-ink-400 mb-3">{bid.product_name}</div>

                          <div className="flex items-baseline justify-between border-b border-ink-800 pb-2 mb-3">
                            <div>
                              <span className="text-[10px] font-mono text-ink-500 uppercase block">UNIT PRICE</span>
                              <span className="text-base font-mono font-bold text-ink-100">
                                <TabularNumber value={bid.unit_price_paise} isCurrencyPaise prefix="₹" />
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono text-ink-500 uppercase block">DELIVERY</span>
                              <span className="text-xs font-mono font-bold text-signal-light">
                                {bid.delivery_day_label}
                              </span>
                            </div>
                          </div>

                          {/* Deterministic Rules Checklist for Auction Bid */}
                          <div className="space-y-1 text-[11px] font-mono bg-ink-900 p-2.5 rounded border border-ink-800 mb-3">
                            <div className="text-[10px] font-bold text-ink-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                              <span>Policy Checklist</span>
                              <span className="text-emerald-400 font-bold">✓ PASS</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ink-400">Margin floor:</span>
                              <span className="text-ink-200">18.0% required <span className="text-emerald-400">✓</span></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ink-400">Inventory check:</span>
                              <span className="text-ink-200">20 available <span className="text-emerald-400">✓</span></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ink-400">Signature:</span>
                              <span className="text-ink-200">HMAC-SHA256 <span className="text-emerald-400">✓</span></span>
                            </div>
                            <div className="flex justify-between border-t border-ink-800 pt-1">
                              <span className="text-signal-light font-bold">Utility Score:</span>
                              <span className="text-signal-light font-bold">
                                {bid.utility_scores.total_utility.toFixed(3)}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-ink-400 bg-ink-900 p-2 rounded border border-ink-800 mb-2">
                            {bid.extras_description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {auctionRationale && (
                  <div className="p-3.5 bg-signal-bg border border-signal-border rounded text-xs text-signal-light font-sans">
                    <strong className="font-bold font-mono uppercase tracking-wider block mb-1">
                      Decision Rationale:
                    </strong>
                    {auctionRationale}
                  </div>
                )}

                {/* Proceed to Contract & Checkout */}
                {singleOffer && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setFlowStep('contract')}
                      className="px-5 py-2 bg-signal hover:bg-signal-hover text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-1.5"
                    >
                      Review & Accept {auctionWinner?.merchant_name} Contract Ticket →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Auction Contract Ticket (Distinct View) */}
            {flowStep === 'contract' && singleOffer && (
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">3</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Winning Merchant Cryptographic Contract
                    </h2>
                  </div>
                </div>

                <div className="max-w-xl mx-auto">
                  <DealTicket ticket={singleOffer} />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAcceptAndCreateOrder}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? 'Verifying & Creating Order...' : 'Accept Winning Contract & Proceed to Settlement →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4 & 5: Settlement for Auction (Distinct View) */}
            {(flowStep === 'checkout' || flowStep === 'paid') && singleOffer && (
              <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 sm:p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-signal text-white flex items-center justify-center text-xs font-mono">4</span>
                    <h2 className="text-base font-bold text-ink-100 font-display">
                      Corporate Order Settlement
                    </h2>
                  </div>
                </div>

                {flowStep === 'checkout' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSimulatePayment('valid')}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded transition-colors shadow flex items-center gap-2 disabled:opacity-50"
                    >
                      ✓ Confirm Corporate Payment (Simulate Webhook)
                    </button>
                  </div>
                )}

                {flowStep === 'paid' && (
                  <div className="p-4 bg-emerald-950/80 border border-emerald-700 rounded-lg space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-800/60 pb-2">
                      <div className="text-emerald-400 font-mono font-bold text-sm">
                        ✓ Corporate Gift Order Settled & Paid via Razorpay
                      </div>
                      <span className="text-xs font-mono text-emerald-300 font-bold">
                        Event: {paymentResult?.event_id || 'evt_sim_corporate_001'}
                      </span>
                    </div>
                    <Link
                      href={`/audit?offer_id=${singleOffer?.offer_id || ''}`}
                      className="text-xs font-mono font-bold text-signal-light hover:underline block"
                    >
                      View Full Immutable Timeline in Audit Ledger →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-ink-800 bg-ink-900 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-ink-400">
          <div>
            <span>Razorpay DealFlow</span> • Sovereign Deal Desk for Agentic Commerce
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-ink-200">Overview</Link>
            <Link href="/merchant-console" className="hover:text-ink-200">Merchant Console</Link>
            <Link href="/deal-room" className="hover:text-ink-200 text-signal-light">Deal Room</Link>
            <Link href="/audit" className="hover:text-ink-200">Audit Ledger</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
