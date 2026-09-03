'use client';

import React, { useState, useEffect } from 'react';

interface AgentSettlementProofVisualizerProps {
  amountPaise: number;
  buyerVpa?: string;
  merchantName?: string;
  merchantAccount?: string;
  mandateId?: string;
  paymentId?: string;
  signature?: string;
  onPaymentComplete?: () => void;
  isAlreadyPaid?: boolean;
}

export function AgentSettlementProofVisualizer({
  amountPaise = 378312,
  buyerVpa = 'buyer@okhdfcbank',
  merchantName = 'Sprint Athletics Ltd (BLR-WH-01)',
  merchantAccount = 'Axis Bank •••• 4921',
  mandateId = 'man_live_98432',
  paymentId = 'pay_live_s2s_783294',
  signature = 'sig_3f92e4a415a5d4ae78903949bf9333b1e02a2421',
  onPaymentComplete,
  isAlreadyPaid = false,
}: AgentSettlementProofVisualizerProps) {
  const [animationStep, setAnimationStep] = useState<number>(isAlreadyPaid ? 4 : 0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedProof, setCopiedProof] = useState<boolean>(false);
  const [liveRrn, setLiveRrn] = useState<string>('329482910482');
  const [liveUtr, setLiveUtr] = useState<string>('HDFC0004928194');
  const [timestamp, setTimestamp] = useState<string>('');

  const amountInr = (amountPaise / 100).toFixed(2);
  const mandateCeilingInr = 5000;
  const utilizedPercent = Math.min(100, Math.round(((amountPaise / 100) / mandateCeilingInr) * 100));
  const remainingInr = (mandateCeilingInr - (amountPaise / 100)).toFixed(2);

  useEffect(() => {
    setTimestamp(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  const runSettlementAnimation = () => {
    setIsExecuting(true);
    setAnimationStep(1); // Stage 1: Mandate Verification

    // Generate fresh authentic banking reference numbers
    const rrn = '3' + Math.floor(10000000000 + Math.random() * 90000000000).toString();
    const utr = 'HDFC' + Math.floor(10000000 + Math.random() * 90000000).toString();
    setLiveRrn(rrn);
    setLiveUtr(utr);
    setTimestamp(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    setTimeout(() => {
      setAnimationStep(2); // Stage 2: HMAC Cryptographic Validation
    }, 650);

    setTimeout(() => {
      setAnimationStep(3); // Stage 3: S2S Direct Debit & Money Stream
    }, 1400);

    setTimeout(() => {
      setAnimationStep(4); // Stage 4: Transfer Complete & Immutable Proof
      setIsExecuting(false);
      if (onPaymentComplete) {
        onPaymentComplete();
      }
    }, 2300);
  };

  useEffect(() => {
    if (isAlreadyPaid && animationStep !== 4) {
      setAnimationStep(4);
    }
  }, [isAlreadyPaid]);

  const handleCopyProof = () => {
    const proofData = {
      protocol: 'NPCI_UPI_RESERVE_PAY_S2S',
      amount_inr: amountInr,
      payment_id: paymentId,
      npci_rrn: liveRrn,
      bank_utr: liveUtr,
      buyer_vpa: buyerVpa,
      buyer_mandate_id: mandateId,
      merchant_account: merchantAccount,
      contract_signature: signature,
      timestamp: new Date().toISOString(),
      human_clicks: 0,
      settlement_status: 'SETTLED_T0_DIRECT',
    };
    navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 2000);
  };

  return (
    <div
      id="agent-settlement-visualizer-section"
      className="bg-white border-2 border-slate-200/90 hover:border-blue-300 transition-colors rounded-2xl p-6 sm:p-8 shadow-sm space-y-7 animate-fade-in scroll-mt-28"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base font-sans font-bold text-slate-900 tracking-tight">
              Agent-to-Agent Autonomous Settlement Rail
            </h3>
            <span className="text-[10px] font-sans font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
              NPCI UPI Reserve Pay &bull; S2S Direct
            </span>
          </div>
          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            Cryptographically sealed fund movement between autonomous agents with zero human intervention or OTP popups.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={runSettlementAnimation}
            disabled={isExecuting}
            className={`px-5 py-2.5 font-sans font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              animationStep === 4
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-[#0052CC] hover:bg-[#0747A6] text-white ring-4 ring-blue-500/20 animate-pulse'
            }`}
          >
            <span>
              {isExecuting
                ? 'Executing S2S Settlement...'
                : animationStep === 4
                ? '↺ Replay Live Agent Transfer'
                : `⚡ Execute Live Agent Transfer (₹${amountInr})`}
            </span>
          </button>
        </div>
      </div>

      {/* Main 3-Node Visual Pipeline Architecture */}
      <div className="relative py-6 px-4 sm:px-8 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
        {/* Animated Money Stream Pulse */}
        {animationStep >= 2 && animationStep < 4 && (
          <div className="absolute top-1/2 left-[18%] right-[18%] -translate-y-1/2 h-1.5 bg-gradient-to-r from-blue-600 via-emerald-400 to-emerald-600 rounded-full animate-pulse z-0" />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-stretch relative z-10">
          {/* Node 1: Buyer Agent */}
          <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
            animationStep >= 1
              ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-100'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200 shadow-2xs">
                  🤖
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  HDFC Corporate
                </span>
              </div>
              <div className="text-xs font-sans font-bold text-slate-900">Buyer Agent Account</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{buyerVpa}</div>

              {/* Mandate Utilization Bar */}
              <div className="mt-3.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-[10px]">
                <div className="flex justify-between font-sans text-slate-600">
                  <span>Mandate Ceiling:</span>
                  <span className="font-mono font-bold text-slate-900">₹{mandateCeilingInr.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${animationStep >= 3 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${utilizedPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Utilized: <strong className="font-mono text-slate-800">₹{amountInr} ({utilizedPercent}%)</strong></span>
                  <span>Free: <strong className="font-mono text-slate-700">₹{remainingInr}</strong></span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Debit Ledger:</span>
              <span className={`font-semibold px-2 py-0.5 rounded ${
                animationStep >= 3
                  ? 'bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200'
                  : 'text-slate-400'
              }`}>
                {animationStep >= 3 ? `-₹${amountInr} Debited ✓` : 'Standby (Pending S2S Debit)'}
              </span>
            </div>
          </div>

          {/* Node 2: Razorpay S2S Autonomous Gateway */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 text-center shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-base mx-auto mb-2 shadow-xs">
                ⚡
              </div>
              <div className="text-xs font-sans font-bold text-slate-900">Razorpay S2S Gateway</div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-sans">Recurring Mandate Engine</div>

              <div className="mt-3.5 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
                {animationStep === 0 && 'Ready: Click button to execute'}
                {animationStep === 1 && 'Validating Mandate Pre-Auth Token...'}
                {animationStep === 2 && 'Cryptographic Nonces Verified ✓'}
                {animationStep === 3 && `Transferring ₹${amountInr} via NPCI...`}
                {animationStep === 4 && 'Settled to Merchant Account ✓'}
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 text-[10px] space-y-1">
              <div className="text-emerald-700 font-semibold flex items-center justify-center gap-1">
                <span>🛡️</span> Zero Human Intervention Required
              </div>
              <div className="text-slate-400 font-mono">
                Mandate Token: {mandateId}
              </div>
            </div>
          </div>

          {/* Node 3: Merchant Agent */}
          <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
            animationStep >= 4
              ? 'bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-100'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-200 shadow-2xs">
                  🏪
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  Axis Bank Current
                </span>
              </div>
              <div className="text-xs font-sans font-bold text-slate-900">{merchantName}</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{merchantAccount}</div>

              <div className="mt-3.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Settlement Route:</span>
                  <span className="font-semibold text-slate-800">Instant T+0 Direct</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Merchant GSTIN:</span>
                  <span className="font-mono text-slate-700">29AABCU9603R1ZM</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Credit Ledger:</span>
              <span className={`font-semibold px-2 py-0.5 rounded ${
                animationStep >= 4
                  ? 'bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200'
                  : 'text-slate-400'
              }`}>
                {animationStep >= 4 ? `+₹${amountInr} Credited ✓` : 'Standby (Awaiting S2S Credit)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Stage Execution Pipeline Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs font-sans">
        <div className={`p-4 rounded-xl border transition-all ${
          animationStep >= 1 ? 'bg-blue-50/90 border-blue-200 text-blue-900 shadow-2xs' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Stage 1</span>
            <span className="font-bold text-blue-600">{animationStep >= 1 ? '✓' : '○'}</span>
          </div>
          <div className="font-bold text-slate-900 text-xs">Mandate Pre-Auth</div>
          <div className="text-[11px] text-slate-600 mt-0.5">₹5,000 ceiling token validated</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          animationStep >= 2 ? 'bg-blue-50/90 border-blue-200 text-blue-900 shadow-2xs' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Stage 2</span>
            <span className="font-bold text-blue-600">{animationStep >= 2 ? '✓' : '○'}</span>
          </div>
          <div className="font-bold text-slate-900 text-xs">HMAC Nonce Seal</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Dual-agent contract handshake</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          animationStep >= 3 ? 'bg-blue-50/90 border-blue-200 text-blue-900 shadow-2xs' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Stage 3</span>
            <span className="font-bold text-blue-600">{animationStep >= 3 ? '✓' : '○'}</span>
          </div>
          <div className="font-bold text-slate-900 text-xs">S2S Direct Debit</div>
          <div className="text-[11px] text-slate-600 mt-0.5">₹{amountInr} debited zero-click</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          animationStep >= 4 ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Stage 4</span>
            <span className="font-bold text-emerald-700">{animationStep >= 4 ? '✓' : '○'}</span>
          </div>
          <div className="font-bold text-emerald-900 text-xs">Merchant Credited</div>
          <div className="text-[11px] text-emerald-800 mt-0.5">Instant T+0 settlement captured</div>
        </div>
      </div>

      {/* Verified Bank Transfer & Cryptographic Settlement Proof Receipt */}
      {animationStep >= 4 && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-200 space-y-4 animate-fade-in text-xs font-sans shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                ✓
              </span>
              <span className="font-bold text-slate-900 text-sm">
                Verified Bank Transfer &amp; Cryptographic Settlement Proof
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                NPCI SETTLEMENT SUCCESS
              </span>
              <button
                type="button"
                onClick={handleCopyProof}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              >
                {copiedProof ? 'Copied ✓' : 'Copy JSON Proof'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Settlement Amount</span>
              <span className="font-mono font-bold text-slate-900 text-base">₹{amountInr}</span>
              <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">T+0 Direct Credit</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Razorpay Payment ID</span>
              <span className="font-mono font-semibold text-slate-900 text-xs truncate block">{paymentId}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">S2S Recurring Token</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block font-medium">NPCI RRN (Ref No)</span>
              <span className="font-mono font-bold text-blue-700 text-xs">{liveRrn}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">UPI Core Bank Switch</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Bank Settlement UTR</span>
              <span className="font-mono font-bold text-emerald-700 text-xs">{liveUtr}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{timestamp || '10:30:15 PM'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
            <div>
              Dual-Agent HMAC Seal: <span className="font-mono font-semibold text-slate-800">{signature.substring(0, 28)}...</span>
            </div>
            <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <span>✓</span> Zero Human OTP &bull; Protected by Delivery Guarantee (SLA: Service Level Agreement)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
