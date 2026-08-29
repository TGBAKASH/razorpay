'use client';

import React, { useEffect, useState } from 'react';
import { TabularNumber } from './TabularNumber';

export interface DealTicketData {
  offer_id: string;
  sku: string;
  product_name?: string;
  quantity: number;
  list_price_paise?: number;
  final_price_paise: number;
  discount_paise: number;
  discount_reasons?: string[];
  delivery_promise?: string;
  return_terms_days?: number;
  payment_methods_allowed?: string[];
  expires_at?: string;
  merchant_id?: string;
  merchant_name?: string;
  signature?: string;
  nonce?: string;
  payment_id?: string;
  payment_amount_paise?: number;
  state?:
    | 'REQUEST_RECEIVED'
    | 'OFFER_CREATED'
    | 'OFFER_GENERATED'
    | 'POLICY_APPROVED'
    | 'OFFER_ACCEPTED'
    | 'ORDER_CREATED'
    | 'SIGNED'
    | 'ACCEPTED'
    | 'APPROVAL_PENDING'
    | 'PAID'
    | 'FAILED'
    | 'REJECTED'
    | 'EXPIRED';
}

interface DealTicketProps {
  ticket: DealTicketData;
  isCompetitorBid?: boolean;
  isWinner?: boolean;
  onAccept?: () => void;
  onPay?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function DealTicket({
  ticket,
  isCompetitorBid = false,
  isWinner = false,
  onAccept,
  onPay,
  isLoading = false,
  className = '',
}: DealTicketProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Live ticking expiry countdown
  useEffect(() => {
    if (!ticket.expires_at) return;

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(ticket.expires_at!).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [ticket.expires_at]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const copyContractJson = () => {
    navigator.clipboard.writeText(JSON.stringify(ticket, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalAmountPaise = ticket.payment_amount_paise || ticket.final_price_paise * ticket.quantity;
  const listTotalPaise = (ticket.list_price_paise || ticket.final_price_paise + ticket.discount_paise) * ticket.quantity;

  const status = ticket.state || (ticket.signature ? 'SIGNED' : 'OFFER_CREATED');
  const isUrgent = secondsLeft !== null && secondsLeft < 120;

  return (
    <div
      className={`ticket-perforated shadow-lg border border-ledger-border p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between select-text w-full max-w-full transition-all duration-300 ${className} ${
        isWinner ? 'ring-2 ring-signal ring-offset-2 ring-offset-ink-950' : ''
      }`}
      style={{ backgroundColor: '#EDEAE0', color: '#10141B' }}
    >
      {/* Background Watermark Crest */}
      <div className="absolute right-3 top-10 opacity-[0.06] pointer-events-none select-none">
        <span className="font-display font-black text-7xl sm:text-8xl text-ink-900 leading-none">
          DEAL
        </span>
      </div>

      {/* Top Header Strip */}
      <div className="border-b border-ledger-border/80 pb-3 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-signal inline-block shrink-0" />
            <span className="font-mono text-[10px] sm:text-[11px] font-bold text-ledger-muted uppercase tracking-wider truncate max-w-[200px] sm:max-w-none">
              {ticket.merchant_name || ticket.merchant_id || 'MERCHANT OFFER DESK'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isWinner && (
              <span className="bg-signal text-white text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                WINNING BID
              </span>
            )}
            <span className="font-mono text-[9px] sm:text-[10px] text-ledger-muted bg-black/5 px-1.5 py-0.5 rounded border border-black/10">
              #{ticket.offer_id ? ticket.offer_id.slice(0, 8).toUpperCase() : 'PENDING'}
            </span>
          </div>
        </div>

        <h3 className="font-display text-base sm:text-lg font-bold text-ledger-ink mt-1 break-words">
          {ticket.product_name || ticket.sku}
        </h3>
      </div>

      {/* Tabular Financial Ledger */}
      <div className="space-y-1.5 text-xs border-b border-ledger-border/80 pb-3 mb-3">
        <div className="flex items-center justify-between py-0.5">
          <span className="text-ledger-muted font-sans">Requested Quantity:</span>
          <TabularNumber value={ticket.quantity} suffix=" units" className="font-bold text-ledger-ink" />
        </div>

        {ticket.list_price_paise && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-ledger-muted font-sans">Catalog List Price:</span>
            <TabularNumber
              value={ticket.list_price_paise}
              isCurrencyPaise
              prefix="₹"
              suffix="/unit"
              className="text-ledger-muted line-through"
            />
          </div>
        )}

        {ticket.discount_paise > 0 && (
          <div className="flex items-center justify-between py-0.5 text-signal">
            <span className="font-sans font-medium">Negotiated Discount:</span>
            <TabularNumber
              value={ticket.discount_paise * ticket.quantity}
              isCurrencyPaise
              prefix="- ₹"
              className="font-bold"
            />
          </div>
        )}

        {/* Final Agreed Settlement Line */}
        <div className="flex items-baseline justify-between pt-2 border-t border-ledger-border/60">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-ledger-ink block">
              Agreed Net Settlement
            </span>
            <span className="text-[10px] font-sans text-ledger-muted">
              Locked integer paise (1:1 with Razorpay)
            </span>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-base sm:text-lg text-ledger-ink tracking-tight">
              <TabularNumber value={totalAmountPaise} isCurrencyPaise prefix="₹" />
            </div>
            {ticket.quantity > 1 && (
              <span className="text-[10px] font-mono text-ledger-muted">
                (<TabularNumber value={ticket.final_price_paise} isCurrencyPaise prefix="₹" /> / unit)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SLA & Terms Strip */}
      <div className="space-y-1.5 text-xs font-sans border-b border-ledger-border/80 pb-3 mb-3">
        {ticket.delivery_promise && (
          <div className="flex items-center justify-between">
            <span className="text-ledger-muted">Delivery Promise:</span>
            <span className="font-mono text-ledger-ink font-semibold">
              {ticket.delivery_promise.includes('T')
                ? new Date(ticket.delivery_promise).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : ticket.delivery_promise}
            </span>
          </div>
        )}

        {ticket.return_terms_days !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-ledger-muted">Return Window:</span>
            <span className="font-mono text-ledger-ink font-medium">
              {ticket.return_terms_days} days
            </span>
          </div>
        )}

        {ticket.payment_methods_allowed && (
          <div className="flex items-center justify-between">
            <span className="text-ledger-muted">Payment Rail:</span>
            <span className="font-mono text-ledger-ink uppercase text-[11px]">
              {ticket.payment_methods_allowed.join(' • ')}
            </span>
          </div>
        )}

        {/* Visibly Ticking Countdown with Low-Time Pulse */}
        {secondsLeft !== null && (
          <div className={`flex items-center justify-between pt-1 ${isUrgent ? 'text-redline' : 'text-amber'}`}>
            <span className="font-medium">Offer Expiry Window:</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${
                isUrgent
                  ? 'bg-redline-bg/20 border-redline-border text-redline animate-pulse'
                  : 'bg-amber/10 border-amber/20 text-amber'
              }`}
            >
              ⏱ {formatCountdown(secondsLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Discount Rationale Bullet Tags */}
      {ticket.discount_reasons && ticket.discount_reasons.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-mono text-ledger-muted uppercase tracking-wider block mb-1 font-bold">
            Policy Decision Factors:
          </span>
          <div className="space-y-1">
            {ticket.discount_reasons.map((reason, idx) => (
              <div
                key={idx}
                className="text-[11px] font-sans text-ledger-ink/90 flex items-start gap-1.5 bg-black/[0.02] p-1 rounded"
              >
                <span className="text-signal font-mono font-bold shrink-0">✓</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cryptographic Seal / Stamp Box */}
      <div className="bg-black/[0.03] border border-black/10 rounded p-2.5 mb-3 font-mono text-[10px]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-ledger-muted uppercase tracking-wider font-bold">
            HMAC-SHA256 Signature
          </span>
          <button
            onClick={copyContractJson}
            type="button"
            className="text-[9px] text-ledger-muted hover:text-ledger-ink underline underline-offset-2 focus-visible:ring-1 focus-visible:ring-signal rounded px-1"
          >
            {copied ? '✓ COPIED JSON' : 'COPY CONTRACT'}
          </button>
        </div>

        <div className="text-[9px] text-ledger-muted/80 break-all leading-tight font-mono">
          {ticket.signature ? (
            <span>DIGEST: {ticket.signature.slice(0, 32)}...</span>
          ) : (
            <span>DIGEST: SHA256_AWAITING_LOCK</span>
          )}
        </div>
        {ticket.nonce && (
          <div className="text-[9px] text-ledger-muted/70 mt-0.5 font-mono">
            NONCE: {ticket.nonce}
          </div>
        )}
      </div>

      {/* Dynamic Stamp Overlay based on State */}
      {(status === 'SIGNED' || status === 'POLICY_APPROVED' || status === 'OFFER_ACCEPTED' || status === 'ORDER_CREATED') && (
        <div className="absolute right-3 sm:right-4 bottom-14 sm:bottom-16 pointer-events-none select-none animate-stamp-drop">
          <div className="border-2 border-signal text-signal px-2.5 sm:px-3 py-0.5 sm:py-1 rounded font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest bg-ledger/90 shadow-sm">
            ✓ POLICY APPROVED
          </div>
        </div>
      )}

      {status === 'PAID' && (
        <div className="absolute right-3 sm:right-4 bottom-14 sm:bottom-16 pointer-events-none select-none animate-stamp-drop">
          <div className="border-2 border-signal text-signal px-2.5 sm:px-3 py-0.5 sm:py-1 rounded font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest bg-ledger/95 shadow-md">
            ★ PAID & SETTLED
          </div>
        </div>
      )}

      {status === 'APPROVAL_PENDING' && (
        <div className="absolute right-3 sm:right-4 bottom-14 sm:bottom-16 pointer-events-none select-none animate-stamp-drop">
          <div className="border-2 border-amber text-amber px-2.5 sm:px-3 py-0.5 sm:py-1 rounded font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest bg-ledger/90 shadow-sm">
            ⏳ HELD FOR APPROVAL
          </div>
        </div>
      )}

      {(status === 'REJECTED' || status === 'FAILED') && (
        <div className="absolute right-3 sm:right-4 bottom-14 sm:bottom-16 pointer-events-none select-none animate-stamp-drop">
          <div className="border-2 border-redline text-redline px-2.5 sm:px-3 py-0.5 sm:py-1 rounded font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest bg-ledger/90 shadow-sm">
            ✕ REJECTED / VOID
          </div>
        </div>
      )}

      {/* Action Strip */}
      <div className="pt-2 flex items-center gap-2">
        {onAccept && status === 'SIGNED' && (
          <button
            onClick={onAccept}
            disabled={isLoading}
            className="w-full py-2.5 px-3 bg-signal hover:bg-signal-light text-white font-sans text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50 min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
          >
            {isLoading ? 'Accepting Offer...' : 'Accept Signed Contract →'}
          </button>
        )}

        {onPay && (status === 'ACCEPTED' || status === 'SIGNED') && (
          <button
            onClick={onPay}
            disabled={isLoading}
            className="w-full py-2.5 px-3 bg-ink-900 hover:bg-ink-800 text-white font-sans text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
          >
            <span>Proceed to Razorpay Checkout</span>
            <TabularNumber value={totalAmountPaise} isCurrencyPaise prefix="(₹" suffix=")" />
          </button>
        )}
      </div>
    </div>
  );
}
