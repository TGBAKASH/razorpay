'use client';

import React from 'react';

interface BargainingConcessionCurveProps {
  revealedTurns?: number;
  buyerCeiling?: number;
  merchantFloor?: number;
  agreedPrice?: number;
}

export function BargainingConcessionCurve({
  revealedTurns = 8,
  buyerCeiling = 3800,
  merchantFloor = 3232,
  agreedPrice = 3783.12,
}: BargainingConcessionCurveProps) {
  let merchantPoints = '';
  if (revealedTurns >= 2) merchantPoints += '80,55 ';
  if (revealedTurns >= 4) merchantPoints += '240,60 ';
  if (revealedTurns >= 6) merchantPoints += '400,60 ';
  if (revealedTurns >= 8) merchantPoints += '560,77';
  merchantPoints = merchantPoints.trim();

  let buyerPoints = '';
  if (revealedTurns >= 1) buyerPoints += '80,102 ';
  if (revealedTurns >= 3) buyerPoints += '240,95 ';
  if (revealedTurns >= 5) buyerPoints += '400,80 ';
  if (revealedTurns >= 7) buyerPoints += '560,77';
  buyerPoints = buyerPoints.trim();

  const isEquilibrium = revealedTurns >= 8;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 font-sans shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            2D Bargaining Concession Curve (Pareto Frontier)
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
              isEquilibrium
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
            }`}
          >
            {isEquilibrium ? '✓ Consensus Equilibrium Reached' : `Negotiating Round ${Math.min(4, Math.ceil(revealedTurns / 2))} of 4`}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] font-sans">
          <span className={`flex items-center gap-1 transition-opacity ${revealedTurns >= 1 ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
            <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> Buyer Bid
          </span>
          <span className={`flex items-center gap-1 transition-opacity ${revealedTurns >= 2 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
            <span className="w-2.5 h-0.5 bg-amber-600 inline-block" /> Merchant Ask
          </span>
          <span className={`flex items-center gap-1 font-bold transition-opacity ${isEquilibrium ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full bg-emerald-600 inline-block ${isEquilibrium ? 'animate-ping' : ''}`} />
            Consensus: ₹{agreedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden bg-white rounded-lg border border-slate-200/80 p-2">
        <svg viewBox="0 0 640 170" className="w-full h-44 text-[10px] select-none font-sans">
          <defs>
            <linearGradient id="concessionGlowSoft" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0052CC" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="60" y1="25" x2="600" y2="25" stroke="#E2E8F0" strokeDasharray="3 3" />
          <line x1="60" y1="77" x2="600" y2="77" stroke="#10B981" strokeDasharray="2 2" strokeOpacity="0.4" />
          <line x1="60" y1="132" x2="600" y2="132" stroke="#EF4444" strokeDasharray="4 4" strokeOpacity="0.6" />
          <line x1="60" y1="155" x2="600" y2="155" stroke="#0052CC" strokeDasharray="4 4" strokeOpacity="0.6" />

          {/* Reference Invariant Labels */}
          <text x="65" y="128" fill="#DC2626" fontSize="9" fontWeight="600">
            Invariant 1: Merchant 18% Floor (₹{merchantFloor.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
          </text>
          <text x="65" y="152" fill="#0052CC" fontSize="9" fontWeight="600">
            Invariant 4: Buyer Target Ceiling (₹{buyerCeiling.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
          </text>
          {isEquilibrium && (
            <text x="310" y="73" fill="#15803D" fontSize="9" fontWeight="bold">
              Optimal Pareto Equilibrium: ₹{agreedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (12% Discount)
            </text>
          )}

          {/* Shaded Concession Corridor between paths */}
          {isEquilibrium && (
            <polygon
              points="80,55 240,60 400,60 560,77 400,80 240,95 80,102"
              fill="url(#concessionGlowSoft)"
              className="animate-fade-in"
            />
          )}

          {/* Merchant Ask Trajectory (Amber) */}
          {merchantPoints.includes(' ') && (
            <polyline
              fill="none"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={merchantPoints}
            />
          )}

          {/* Buyer Bid Trajectory (Blue) */}
          {buyerPoints.includes(' ') && (
            <polyline
              fill="none"
              stroke="#0052CC"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={buyerPoints}
            />
          )}

          {/* Data Points - Merchant */}
          {revealedTurns >= 2 && (
            <g className="animate-fade-in">
              <circle cx="80" cy="55" r="4" fill="#D97706" />
              <text x="70" y="46" fill="#B45309" fontSize="9" fontWeight="600">₹3,998</text>
            </g>
          )}

          {revealedTurns >= 4 && (
            <g className="animate-fade-in">
              <circle cx="240" cy="60" r="4" fill="#D97706" />
              <text x="230" y="51" fill="#B45309" fontSize="9" fontWeight="600">₹3,949</text>
            </g>
          )}

          {revealedTurns >= 6 && (
            <g className="animate-fade-in">
              <circle cx="400" cy="60" r="4" fill="#D97706" />
              <text x="390" y="51" fill="#B45309" fontSize="9" fontWeight="600">₹3,949</text>
            </g>
          )}

          {/* Data Points - Buyer */}
          {revealedTurns >= 1 && (
            <g className="animate-fade-in">
              <circle cx="80" cy="102" r="4" fill="#0052CC" />
              <text x="70" y="116" fill="#0052CC" fontSize="9" fontWeight="600">₹3,525</text>
            </g>
          )}

          {revealedTurns >= 3 && (
            <g className="animate-fade-in">
              <circle cx="240" cy="95" r="4" fill="#0052CC" />
              <text x="230" y="109" fill="#0052CC" fontSize="9" fontWeight="600">₹3,600</text>
            </g>
          )}

          {revealedTurns >= 5 && (
            <g className="animate-fade-in">
              <circle cx="400" cy="80" r="4" fill="#0052CC" />
              <text x="390" y="94" fill="#0052CC" fontSize="9" fontWeight="600">₹3,750</text>
            </g>
          )}

          {/* Equilibrium Intersection Point */}
          {isEquilibrium && (
            <g className="animate-fade-in">
              <circle cx="560" cy="77" r="7" fill="#16A34A" className="animate-pulse" />
              <circle cx="560" cy="77" r="3" fill="#FFFFFF" />
              <text x="460" y="94" fill="#15803D" fontSize="10" fontWeight="bold">
                Consensus: ₹{agreedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ✓
              </text>
            </g>
          )}

          {/* X Axis Rounds */}
          <text x="70" y="166" fill={revealedTurns >= 1 ? '#0F172A' : '#94A3B8'} fontSize="10" fontWeight="500">Round 1</text>
          <text x="230" y="166" fill={revealedTurns >= 3 ? '#0F172A' : '#94A3B8'} fontSize="10" fontWeight="500">Round 2</text>
          <text x="390" y="166" fill={revealedTurns >= 5 ? '#0F172A' : '#94A3B8'} fontSize="10" fontWeight="500">Round 3</text>
          <text x="525" y="166" fill={isEquilibrium ? '#15803D' : '#94A3B8'} fontSize="10" fontWeight="bold">
            Round 4 (Consensus)
          </text>
        </svg>
      </div>
    </div>
  );
}
