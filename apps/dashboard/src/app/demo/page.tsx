'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DealLifecycleNav, LifecycleStage } from '../../components/DealLifecycleNav';
import { DealTicket, DealTicketData } from '../../components/DealTicket';
import { TabularNumber } from '../../components/TabularNumber';

interface DemoStep {
  stepNumber: number;
  stage: LifecycleStage;
  title: string;
  badge: string;
  caption: string;
  technicalRationale: string;
  invariantEnforced: string;
}

interface FailureScenario {
  id: string;
  name: string;
  code: string;
  badgeColor: 'redline' | 'amber';
  title: string;
  caption: string;
  whatFailed: string;
  systemAction: string;
  invariant: string;
}

export default function DemoPage() {
  const [activeScript, setActiveScript] = useState<'single' | 'auction'>('single');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(5000); // Default 5 seconds for narration
  const [activeFailure, setActiveFailure] = useState<FailureScenario | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Script A: Single-Merchant SprintPro X2 Flow
  const scriptASteps: DemoStep[] = [
    {
      stepNumber: 1,
      stage: 'REQUEST_RECEIVED',
      badge: 'PHASE 01 • INTENT SPECIFICATION',
      title: 'STEP 1: BUYER AGENT RFP ARRIVES',
      caption:
        'An autonomous AI buyer agent requests 1 pair of SprintPro X2 running shoes with a budget ceiling of ₹4,000, requesting Tuesday delivery and UPI payment.',
      technicalRationale:
        'Buyer agent constraints are parsed into strict integer paise (₹4,000 = 400,000 paise). The merchant agent initializes the negotiation session.',
      invariantEnforced: 'Budget ceiling cannot be silently exceeded. Currency and units locked.',
    },
    {
      stepNumber: 2,
      stage: 'OFFER_GENERATED',
      badge: 'PHASE 02 • DETERMINISTIC PRICING',
      title: 'STEP 2: BOUNDED DISCOUNT GENERATION',
      caption:
        'DealFlow evaluates merchant policy rules: margin floor (18%), stock clearance (41 pairs in warehouse), and payment rail (prepaid UPI). It crafts an offer at ₹3,949, saving the buyer ₹350 while locking in 49% profit margin for the merchant.',
      technicalRationale:
        'List price ₹4,299 - ₹150 UPI discount - ₹200 stock clearance discount = ₹3,949. Cost is ₹2,650, yielding ₹1,299 gross margin (49.02%), safely above the 18% policy floor.',
      invariantEnforced: 'Gross margin must exceed 18% policy floor. Auto-discount cannot exceed 12% ceiling.',
    },
    {
      stepNumber: 3,
      stage: 'POLICY_APPROVED',
      badge: 'PHASE 03 • CRYPTOGRAPHIC SEAL',
      title: 'STEP 3: CRYPTOGRAPHIC CONTRACT SEALING',
      caption:
        'The offer is sealed into an immutable bilateral contract ticket using HMAC-SHA256 and a single-use nonce. Neither party can alter the price, delivery date, or return terms without invalidating the cryptographic signature.',
      technicalRationale:
        'Canonical JSON payload hashed with merchant secret key. Nonce "nonce_98f12a3d7b4" generated and stored in Redis lock with 15-minute TTL.',
      invariantEnforced: 'Signed contracts are tamper-evident. Single-use nonce prevents replay attacks.',
    },
    {
      stepNumber: 4,
      stage: 'OFFER_ACCEPTED',
      badge: 'PHASE 04 • BUYER HANDSHAKE',
      title: 'STEP 4: BUYER HANDSHAKE & ACCEPTANCE',
      caption:
        'The buyer agent verifies the merchant signature and accepts the contract. DealFlow locks the contract state, preventing double-spending or duplicate acceptance.',
      technicalRationale:
        'Buyer validates HMAC signature against merchant public key, checks deadline reachability, and commits acceptance. State transitions to OFFER_ACCEPTED.',
      invariantEnforced: 'Acceptance must occur before expires_at timestamp. Nonce consumed atomically.',
    },
    {
      stepNumber: 5,
      stage: 'ORDER_CREATED',
      badge: 'PHASE 05 • RAZORPAY GATEWAY LOCK',
      title: 'STEP 5: 1:1 LOCKED RAZORPAY ORDER',
      caption:
        'DealFlow creates Razorpay Order #order_Nx8Y102948 locked to exactly ₹3,949.00 (394,900 paise). The gateway amount is cryptographically bound 1:1 to the signed contract.',
      technicalRationale:
        'Razorpay Orders API called with exact integer paise (394900). Order notes contain contract_id and offer_id for cryptographic reconciliation.',
      invariantEnforced: 'Order amount matches contract final_price_paise exactly. Zero price drift permitted.',
    },
    {
      stepNumber: 6,
      stage: 'PAID',
      badge: 'PHASE 06 • SETTLEMENT & AUDIT',
      title: 'STEP 6: PAYMENT CAPTURE & IMMUTABLE SETTLEMENT',
      caption:
        'Razorpay webhook delivers payment.captured. DealFlow verifies the raw request body HMAC signature, confirms the amount matches the locked contract, and transitions the deal to PAID in the cryptographic audit ledger.',
      technicalRationale:
        'Raw webhook payload verified using x-razorpay-signature before body parsing. Deal ticket stamped [ PAID & SETTLED ]. Complete trace written to append-only audit log.',
      invariantEnforced: 'Raw body signature verification required. Webhook replay idempotency enforced.',
    },
  ];

  // Script B: 3-Merchant Corporate Gift-Box Auction Flow
  const scriptBSteps: DemoStep[] = [
    {
      stepNumber: 1,
      stage: 'REQUEST_RECEIVED',
      badge: 'AUCTION PHASE 01 • RFP BROADCAST',
      title: 'STEP 1: BROADCAST RFP FOR 20 GIFT BOXES',
      caption:
        'Buyer agent broadcasts an RFP for 20 corporate gift boxes with a budget cap of ₹30,000 per unit, ranking Delivery Speed as the #1 priority.',
      technicalRationale:
        'RFP broadcast to 3 merchant adapters concurrently. Multi-attribute utility weights assigned: Delivery Speed (0.45), Price (0.35), Extras (0.20).',
      invariantEnforced: 'Broadcast fans out simultaneously to all qualified merchants with identical constraints.',
    },
    {
      stepNumber: 2,
      stage: 'OFFER_GENERATED',
      badge: 'AUCTION PHASE 02 • PARALLEL BIDS',
      title: 'STEP 2: 3 PARALLEL INDEPENDENT BIDS',
      caption:
        'Merchants A, B, and C independently calculate bids based on their own inventory and logistics SLAs. Each merchant generates a signed deal ticket.',
      technicalRationale:
        'Merchant A: ₹29,500 (Thursday delivery, custom logo). Merchant B: ₹28,900 (Friday delivery, standard). Merchant C: ₹30,000 (Wednesday delivery, 15-day warranty).',
      invariantEnforced: 'Each merchant evaluates margins independently without collusion or price leaking.',
    },
    {
      stepNumber: 3,
      stage: 'POLICY_APPROVED',
      badge: 'AUCTION PHASE 03 • UTILITY SELECTION',
      title: 'STEP 3: MULTI-ATTRIBUTE UTILITY WINNER',
      caption:
        'Buyer agent scores all 3 bids across Price, Speed, and Extras. Merchant C wins with utility score 0.775 because its Wednesday delivery satisfies the buyer’s #1 speed priority.',
      technicalRationale:
        'MAUT formula: Score = (0.45 * Speed) + (0.35 * Price) + (0.20 * Extras). Merchant C achieves 0.775 vs Merchant A (0.485) and Merchant B (0.350).',
      invariantEnforced: 'Winner selection is deterministic based on declared buyer priority weights.',
    },
    {
      stepNumber: 4,
      stage: 'OFFER_ACCEPTED',
      badge: 'AUCTION PHASE 04 • CONTRACT COMMIT',
      title: 'STEP 4: WINNING CONTRACT ACCEPTED',
      caption:
        'Buyer agent signs the contract ticket with Merchant C for 20 units at ₹30,000 each (total order ₹6,00,000).',
      technicalRationale:
        'Bilateral contract signed for 20 units @ ₹30,000. Merchant C reserves 20 units in warehouse inventory.',
      invariantEnforced: 'Losing bids cleanly expired with zero financial obligation.',
    },
    {
      stepNumber: 5,
      stage: 'ORDER_CREATED',
      badge: 'AUCTION PHASE 05 • BULK ORDER CREATION',
      title: 'STEP 5: RAZORPAY BULK ORDER CREATED',
      caption:
        'Razorpay Order #order_bulk_giftbox_01 created for ₹6,00,000 locked strictly to Merchant C’s contract ticket.',
      technicalRationale:
        'Bulk order created at 60,000,000 paise (₹6,00,000). Corporate GST invoice metadata attached.',
      invariantEnforced: 'Total order value matches unit_price * quantity with zero calculation drift.',
    },
    {
      stepNumber: 6,
      stage: 'PAID',
      badge: 'AUCTION PHASE 06 • SETTLEMENT & WARRANTY',
      title: 'STEP 6: SETTLEMENT COMPLETE & DISPUTE WINDOW ACTIVATED',
      caption:
        'Payment captured via Razorpay. DealFlow activates the 15-day return warranty and dispute window in the audit ledger.',
      technicalRationale:
        'Webhook reconciled. State marked PAID. 15-day return escrow timer initiated.',
      invariantEnforced: 'Post-payment dispute terms strictly match the contract promise.',
    },
  ];

  // 3 Phase 11 Failure Scenarios
  const failureScenarios: FailureScenario[] = [
    {
      id: 'failure-inventory-race',
      name: '1. Inventory Race',
      code: 'INVENTORY_RACE',
      badgeColor: 'amber',
      title: 'FAILURE CAUGHT: INVENTORY RACE AT ACCEPT-TIME',
      caption:
        'Offer was signed for qty 2, but warehouse inventory dropped to 1 before buyer acceptance arrived. Instead of silently shipping partial quantity or overcharging, DealFlow cleanly expires the offer with ZERO charge to the buyer.',
      whatFailed: 'Live warehouse stock depleted from 2 to 1 during buyer agent deliberation window.',
      systemAction: 'Acceptance rejected with INVENTORY_DEPLETED (409). Offer cleanly expired. Buyer charged ₹0.',
      invariant: 'Never silently substitute partial quantity or charge buyer for unavailable stock.',
    },
    {
      id: 'failure-tampered-offer',
      name: '2. Offer Tampering',
      code: 'TAMPER_DIGIT_FLIP',
      badgeColor: 'redline',
      title: 'FAILURE CAUGHT: CRYPTOGRAPHIC SIGNATURE MISMATCH',
      caption:
        'A compromised accept request altered final_price_paise from ₹3,949 to ₹2,949 (digit flip attack). DealFlow’s HMAC-SHA256 check fails immediately and rejects the request before any Razorpay API call is made.',
      whatFailed: 'Compromised request altered payload price from 394900 to 294900 paise.',
      systemAction: 'HMAC verification failed. Gateway order creation blocked. Security alarm logged.',
      invariant: 'Cryptographic contract check must pass before any payment gateway API call.',
    },
    {
      id: 'failure-payment-retry',
      name: '3. Payment Failure & Retry',
      code: 'PAYMENT_FAILURE_RETRY',
      badgeColor: 'amber',
      title: 'FAILURE HANDLED: PAYMENT FAILURE WITH ZERO PRICE DRIFT',
      caption:
        'The buyer’s payment card failed at the Razorpay gateway. DealFlow prompts for an alternative payment method while keeping the agreed contract price (₹3,949) strictly unchanged—preventing predatory win-back discounting.',
      whatFailed: 'Gateway reported payment card decline or network timeout.',
      systemAction: 'Offer remains in OFFER_CREATED state for retry. Price locked strictly at ₹3,949.',
      invariant: 'Payment retries must not alter agreed contract price (zero win-back discounting).',
    },
  ];

  const currentSteps = activeScript === 'single' ? scriptASteps : scriptBSteps;
  const currentStep = currentSteps[currentStepIndex] || currentSteps[0]!;

  // Playback Loop
  useEffect(() => {
    if (isPlaying && !activeFailure) {
      timerRef.current = setTimeout(() => {
        setCurrentStepIndex((prev) => {
          if (prev < currentSteps.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, playbackSpeedMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStepIndex, playbackSpeedMs, currentSteps.length, activeFailure]);

  const handlePlayPause = () => {
    setActiveFailure(null);
    if (currentStepIndex >= currentSteps.length - 1 && !isPlaying) {
      setCurrentStepIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    setActiveFailure(null);
    setIsPlaying(false);
    if (currentStepIndex < currentSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleStepBack = () => {
    setActiveFailure(null);
    setIsPlaying(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleRestart = () => {
    setActiveFailure(null);
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const handleSwitchScript = (script: 'single' | 'auction') => {
    setActiveFailure(null);
    setIsPlaying(false);
    setActiveScript(script);
    setCurrentStepIndex(0);
  };

  const handleTriggerFailure = (failure: FailureScenario) => {
    setIsPlaying(false);
    setActiveFailure(failure);
  };

  // Construct Deal Ticket State based on current step
  const sampleTicket: DealTicketData = {
    offer_id: activeScript === 'single' ? 'offer-sprintpro-demo-01' : 'offer-giftbox-corp-c',
    sku: activeScript === 'single' ? 'SPRINTPRO-X2' : 'GIFTBOX-CORP-C',
    product_name:
      activeScript === 'single'
        ? 'SprintPro X2 Running Shoes (Titanium Grey)'
        : 'Priority Express Gift Box (C) - 20 Units',
    quantity: activeScript === 'single' ? 1 : 20,
    list_price_paise: activeScript === 'single' ? 429900 : 3300000,
    final_price_paise: activeScript === 'single' ? 394900 : 3000000,
    discount_paise: activeScript === 'single' ? 35000 : 300000,
    discount_reasons:
      activeScript === 'single'
        ? [
            'Prepaid payment incentive (UPI rail selected)',
            'Inventory clearance volume match (41 pairs in BLR)',
            'Guaranteed Tuesday delivery SLA',
          ]
        : [
            'Bulk order volume discount (20 units)',
            'Wednesday guaranteed express logistics',
            '15-day return and replacement warranty included',
          ],
    delivery_promise: activeScript === 'single' ? '2026-08-31T23:59:59Z' : '2026-09-02T23:59:59Z',
    return_terms_days: activeScript === 'single' ? 10 : 15,
    payment_methods_allowed: ['UPI', 'Card'],
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    merchant_id: activeScript === 'single' ? 'merchant-sprint-alpha' : 'merchant-c-express',
    merchant_name:
      activeScript === 'single' ? 'SprintPro Footwear Ltd.' : 'Merchant C (Express Logistics)',
    signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    nonce: 'nonce_98f12a3d7b4',
    state:
      currentStep.stage === 'PAID'
        ? 'PAID'
        : currentStep.stage === 'OFFER_ACCEPTED' || currentStep.stage === 'ORDER_CREATED'
        ? 'SIGNED'
        : currentStep.stage === 'POLICY_APPROVED'
        ? 'POLICY_APPROVED'
        : 'OFFER_CREATED',
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav currentStage={activeFailure ? 'OFFER_GENERATED' : currentStep.stage} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
        {/* Top Control Bar for Video Recording */}
        <div className="border border-ink-700 bg-ink-900 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
          {/* Script Selectors */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-ink-400 uppercase mr-1">DEMO SCRIPT:</span>
            <button
              onClick={() => handleSwitchScript('single')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                activeScript === 'single'
                  ? 'bg-signal-bg text-signal-light border border-signal-border font-bold'
                  : 'bg-ink-950 text-ink-400 border border-ink-800 hover:text-ink-200'
              }`}
            >
              (A) Single-Merchant SprintPro X2
            </button>
            <button
              onClick={() => handleSwitchScript('auction')}
              className={`py-1.5 px-3 rounded text-xs font-mono transition-colors ${
                activeScript === 'auction'
                  ? 'bg-signal-bg text-signal-light border border-signal-border font-bold'
                  : 'bg-ink-950 text-ink-400 border border-ink-800 hover:text-ink-200'
              }`}
            >
              (B) 3-Merchant Gift-Box Auction
            </button>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="py-1.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-200 border border-ink-600 rounded text-xs font-mono flex items-center gap-1 transition-colors"
              title="Reset demo data to beginning"
            >
              <span>↺</span> Restart
            </button>

            <button
              onClick={handleStepBack}
              disabled={currentStepIndex === 0}
              className="py-1.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-200 border border-ink-600 rounded text-xs font-mono disabled:opacity-40 transition-colors"
              title="Step back one transition"
            >
              ⏮ Back
            </button>

            <button
              onClick={handlePlayPause}
              className={`py-1.5 px-4 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow ${
                isPlaying
                  ? 'bg-amber text-ink-950 hover:bg-amber-light'
                  : 'bg-signal text-white hover:bg-signal-light'
              }`}
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play Demo'}</span>
            </button>

            <button
              onClick={handleStepForward}
              disabled={currentStepIndex >= currentSteps.length - 1}
              className="py-1.5 px-3 bg-ink-800 hover:bg-ink-750 text-ink-200 border border-ink-600 rounded text-xs font-mono disabled:opacity-40 transition-colors"
              title="Step forward one transition"
            >
              Step Forward ⏭
            </button>

            {/* Pacing Toggle */}
            <div className="flex items-center gap-1 ml-2 bg-ink-950 p-1 rounded border border-ink-800 text-[10px] font-mono">
              <span className="text-ink-500 px-1">SPEED:</span>
              <button
                onClick={() => setPlaybackSpeedMs(5000)}
                className={`px-2 py-0.5 rounded ${
                  playbackSpeedMs === 5000
                    ? 'bg-ink-800 text-ink-100 font-bold'
                    : 'text-ink-500 hover:text-ink-300'
                }`}
              >
                5s (Narration)
              </button>
              <button
                onClick={() => setPlaybackSpeedMs(2500)}
                className={`px-2 py-0.5 rounded ${
                  playbackSpeedMs === 2500
                    ? 'bg-ink-800 text-ink-100 font-bold'
                    : 'text-ink-500 hover:text-ink-300'
                }`}
              >
                2.5s (Fast)
              </button>
            </div>
          </div>
        </div>

        {/* PROMINENT FULL-WIDTH NARRATION CAPTION CARD */}
        {!activeFailure ? (
          <div className="bg-ink-900 border-2 border-signal-border/80 rounded-xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-black text-signal bg-signal-bg border border-signal-border px-2.5 py-1 rounded">
                  {currentStep.badge}
                </span>
                <span className="font-mono text-xs text-ink-400">
                  STEP {currentStep.stepNumber} OF {currentSteps.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-500">STATE MACHINE:</span>
                <span className="font-mono text-xs font-bold text-signal bg-ink-950 px-2 py-0.5 rounded border border-ink-800">
                  {currentStep.stage}
                </span>
              </div>
            </div>

            {/* Large Plain-English Headline & Caption */}
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-100 tracking-tight">
                {currentStep.title}
              </h2>

              <p className="text-base sm:text-lg text-ink-100 font-sans mt-3 leading-relaxed font-normal bg-ink-950/60 p-4 rounded-lg border border-ink-800/80">
                {currentStep.caption}
              </p>
            </div>

            {/* Technical Rationale & Invariant Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
                <span className="text-ink-500 text-[10px] uppercase font-bold block">
                  TECHNICAL ENGINE RATIONALE:
                </span>
                <p className="text-ink-300">{currentStep.technicalRationale}</p>
              </div>

              <div className="bg-ink-950 p-3 rounded border border-signal-border/40 space-y-1">
                <span className="text-signal text-[10px] uppercase font-bold block">
                  SYSTEM INVARIANT ENFORCED:
                </span>
                <p className="text-signal-light">{currentStep.invariantEnforced}</p>
              </div>
            </div>
          </div>
        ) : (
          /* PROMINENT FAILURE SCENARIO CAPTION BANNER */
          <div
            className={`rounded-xl p-6 sm:p-8 space-y-4 shadow-xl border-2 ${
              activeFailure.badgeColor === 'redline'
                ? 'bg-redline-bg/40 border-redline-border text-redline-light'
                : 'bg-amber-bg/40 border-amber-border text-amber-light'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-ink-950 border border-ink-700">
                  ⚠️ INVARIANT VIOLATION TEST STATION
                </span>
                <span className="font-mono text-xs text-ink-300">
                  CODE: {activeFailure.code}
                </span>
              </div>

              <button
                onClick={() => setActiveFailure(null)}
                className="py-1 px-3 bg-ink-950 hover:bg-ink-900 text-ink-200 border border-ink-700 rounded text-xs font-mono"
              >
                [ Resume Demo Flow ✕ ]
              </button>
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-100">
                {activeFailure.title}
              </h2>

              <p className="text-base sm:text-lg text-ink-100 font-sans mt-3 leading-relaxed bg-ink-950/80 p-4 rounded-lg border border-ink-800">
                {activeFailure.caption}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
                <span className="text-ink-500 text-[10px] uppercase font-bold block">
                  WHAT TRIGGERED:
                </span>
                <p className="text-ink-300">{activeFailure.whatFailed}</p>
              </div>

              <div className="bg-ink-950 p-3 rounded border border-ink-800 space-y-1">
                <span className="text-signal text-[10px] uppercase font-bold block">
                  SYSTEM RESPONSE:
                </span>
                <p className="text-signal-light">{activeFailure.systemAction}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Presentation Visual Desk */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stamped Deal Ticket Component */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <h3 className="font-display text-base font-bold text-ink-100">
                Bilateral Deal Ticket (Physical Ledger Slip)
              </h3>
              <span className="font-mono text-[10px] text-signal font-bold uppercase">
                {sampleTicket.state}
              </span>
            </div>

            <DealTicket ticket={sampleTicket} />
          </div>

          {/* Right Column: Failure Triggers & Step Progression Matrix */}
          <div className="lg:col-span-6 space-y-6">
            {/* 3 Live Failure Scenario Buttons */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-3">
              <div className="border-b border-ink-800 pb-2">
                <h3 className="font-display text-sm font-bold text-ink-100">
                  Trigger Invariant Failure Scenarios (Live Edge Cases)
                </h3>
                <p className="text-xs text-ink-400 font-sans mt-0.5">
                  Click any button to demonstrate DealFlow’s deterministic guardrails during narration:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {failureScenarios.map((failure) => (
                  <button
                    key={failure.id}
                    onClick={() => handleTriggerFailure(failure)}
                    className={`py-2 px-3 rounded text-xs font-mono font-semibold border transition-colors text-left space-y-1 ${
                      activeFailure?.id === failure.id
                        ? 'bg-amber-bg border-amber text-amber font-bold'
                        : 'bg-ink-950 border-ink-700 text-ink-300 hover:border-ink-500'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{failure.name}</div>
                    <div className="text-[9px] text-ink-500">{failure.code}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 6 Step Progress Timeline */}
            <div className="bg-ink-900 border border-ink-700 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                <h3 className="font-display text-sm font-bold text-ink-100">
                  State Machine Trajectory
                </h3>
                <span className="font-mono text-[10px] text-ink-500">
                  DETERMINISTIC
                </span>
              </div>

              <div className="space-y-2">
                {currentSteps.map((s, idx) => {
                  const isCurrent = currentStepIndex === idx && !activeFailure;
                  const isPassed = currentStepIndex > idx && !activeFailure;

                  return (
                    <button
                      key={s.stepNumber}
                      onClick={() => {
                        setActiveFailure(null);
                        setIsPlaying(false);
                        setCurrentStepIndex(idx);
                      }}
                      className={`w-full text-left p-2.5 rounded text-xs font-mono flex items-center justify-between transition-colors border ${
                        isCurrent
                          ? 'bg-signal-bg border-signal-border text-signal-light font-bold'
                          : isPassed
                          ? 'bg-ink-950 border-ink-800 text-ink-300 hover:bg-ink-850'
                          : 'bg-ink-950/40 border-ink-850 text-ink-600 hover:bg-ink-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                            isCurrent
                              ? 'bg-signal text-white'
                              : isPassed
                              ? 'bg-ink-800 text-signal'
                              : 'bg-ink-900 text-ink-600'
                          }`}
                        >
                          {isPassed ? '✓' : s.stepNumber}
                        </span>
                        <span>{s.stage}</span>
                      </div>

                      <span className="text-[10px] text-ink-500 font-sans">
                        {isCurrent ? '● CURRENT' : isPassed ? 'PASSED' : 'PENDING'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-800 bg-ink-950 py-4 select-none mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-ink-500">
          <div className="flex items-center gap-3">
            <span>DETERMINISTIC PRESENTATION SUITE</span>
            <span>•</span>
            <span>ZERO RANDOM DATA</span>
            <span>•</span>
            <span>100% REPRODUCIBLE RECORDING</span>
          </div>

          <Link href="/" className="hover:text-ink-300">
            ← Return to Overview
          </Link>
        </div>
      </footer>
    </div>
  );
}
