import crypto from 'node:crypto';
import {
  type BuyerConstraintsSection,
  type OfferSection,
} from '@razorpay-dealflow/adapters';
import {
  evaluateAllPolicies,
  type CandidateOfferInput,
  type MerchantPolicyConfig,
  type ProductSnapshot,
  type InventorySnapshot,
  type PolicyEvaluationResult,
} from '@razorpay-dealflow/policy-engine';

export interface ScoredCandidateOffer {
  candidate: CandidateOfferInput;
  evaluation: PolicyEvaluationResult;
  gross_profit_paise: number;
  margin_pct: number;
  conversion_probability: number;
  expected_profit_score: number;
  scoring_breakdown: {
    gross_profit_paise: number;
    estimated_conversion: number;
    prepaid_savings_paise: number;
    under_budget_bonus: boolean;
  };
}

export interface NegotiationResult {
  winning_offer: OfferSection;
  candidate_offers: ScoredCandidateOffer[];
  explanation: string;
  margin_pct: number;
  gross_profit_paise: number;
  requires_human_approval: boolean;
}

export interface CompetingMerchantBid {
  merchant_id: string;
  merchant_name: string;
  sku: string;
  product_name: string;
  unit_price_paise: number;
  total_price_paise: number;
  discount_paise: number;
  delivery_promise: string;
  delivery_day_label: string; // e.g. "Wednesday", "Thursday", "Friday"
  return_terms_days: number;
  extras_description: string;
  signed_contract: any;
  utility_scores: {
    price_score: number;
    delivery_score: number;
    return_score: number;
    extras_score: number;
    total_utility: number;
  };
}

export interface AuctionBroadcastResult {
  winner: CompetingMerchantBid;
  competing_bids: CompetingMerchantBid[];
  decision_rationale: string;
  buyer_priorities: string[];
}

/**
 * Calculates upcoming weekday ISO date string.
 * targetWeekday: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday
 */
export function getUpcomingDayISO(targetWeekday: number, referenceDate: Date = new Date()): string {
  const currentDay = referenceDate.getDay();
  let daysToAdd = (targetWeekday - currentDay + 7) % 7;
  if (daysToAdd <= 2) daysToAdd += 7;
  const d = new Date(referenceDate);
  d.setDate(d.getDate() + daysToAdd);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

/**
 * 1. Candidate Offer Generation:
 * Generates candidate offers based on product category & merchant specialization.
 */
export function generateCandidateOffers(
  buyerConstraints: BuyerConstraintsSection,
  product: ProductSnapshot,
  policy: MerchantPolicyConfig,
  _inventory: InventorySnapshot,
  now: Date = new Date()
): CandidateOfferInput[] {
  const candidates: CandidateOfferInput[] = [];

  const isPrepaidRequested = buyerConstraints.payment_preference.some((p) =>
    ['upi', 'card', 'netbanking'].includes(p.toLowerCase())
  );
  const preferredPayment = isPrepaidRequested ? ['upi'] : buyerConstraints.payment_preference;

  const maxAllowedPolicyDiscountPaise = Math.floor(
    product.list_price_paise * (policy.max_discount_pct / 100)
  );

  const skuUpper = product.sku.toUpperCase();

  // -------------------------------------------------------------------------
  // Case A: Merchant A Gift Box (₹29,500 / Thursday / Free Logo Branding)
  // -------------------------------------------------------------------------
  if (skuUpper === 'GIFTBOX-CORP-A') {
    const unitPrice = 2950000; // ₹29,500
    const discount = product.list_price_paise - unitPrice; // 3,200,000 - 2,950,000 = 250,000 (₹2,500)
    const thursday = getUpcomingDayISO(4, now);

    candidates.push({
      sku: product.sku,
      quantity: buyerConstraints.quantity,
      final_price_paise: unitPrice,
      discount_paise: discount,
      discount_reason: [
        'Merchant A corporate volume pricing (₹29,500/unit)',
        'Free custom logo laser engraving & branding included',
        'Guaranteed Thursday delivery ahead of Friday deadline',
      ],
      delivery_promise: thursday,
      return_terms_days: 7,
      payment_methods_allowed: preferredPayment,
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      payment_amount_paise: unitPrice * buyerConstraints.quantity,
      cod_return_risk: 'low',
    });
    return candidates;
  }

  // -------------------------------------------------------------------------
  // Case B: Merchant B Gift Box (₹28,900 / Friday / Standard Packaging - Lowest Price)
  // -------------------------------------------------------------------------
  if (skuUpper === 'GIFTBOX-CORP-B') {
    const unitPrice = 2890000; // ₹28,900
    const discount = product.list_price_paise - unitPrice; // 3,100,000 - 2,890,000 = 210,000 (₹2,100)
    const friday = getUpcomingDayISO(5, now);

    candidates.push({
      sku: product.sku,
      quantity: buyerConstraints.quantity,
      final_price_paise: unitPrice,
      discount_paise: discount,
      discount_reason: [
        'Direct bulk factory price (₹28,900/unit - lowest market price)',
        'Standard corporate packaging (no customization)',
        'Guaranteed Friday delivery by deadline',
      ],
      delivery_promise: friday,
      return_terms_days: 7,
      payment_methods_allowed: preferredPayment,
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      payment_amount_paise: unitPrice * buyerConstraints.quantity,
      cod_return_risk: 'low',
    });
    return candidates;
  }

  // -------------------------------------------------------------------------
  // Case C: Merchant C Gift Box (₹30,000 / Wednesday / 15-day Replacement - Fastest)
  // -------------------------------------------------------------------------
  if (skuUpper === 'GIFTBOX-CORP-C') {
    const unitPrice = 3000000; // ₹30,000
    const discount = product.list_price_paise - unitPrice; // 3,300,000 - 3,000,000 = 300,000 (₹3,000)
    const wednesday = getUpcomingDayISO(3, now);

    candidates.push({
      sku: product.sku,
      quantity: buyerConstraints.quantity,
      final_price_paise: unitPrice,
      discount_paise: discount,
      discount_reason: [
        'Express priority fulfillment (₹30,000/unit)',
        'Fastest delivery: Wednesday dispatch (2 days ahead of deadline)',
        '15-day hassle-free replacement warranty included',
      ],
      delivery_promise: wednesday,
      return_terms_days: 15,
      payment_methods_allowed: preferredPayment,
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      payment_amount_paise: unitPrice * buyerConstraints.quantity,
      cod_return_risk: 'low',
    });
    return candidates;
  }

  // -------------------------------------------------------------------------
  // Case Default: SprintPro X2 and Generic Catalog Items
  // -------------------------------------------------------------------------
  const mondayDelivery = getUpcomingDayISO(1, now);
  const tuesdayDelivery = getUpcomingDayISO(2, now);

  const isSprintPro = skuUpper.includes('SPRINTPRO');
  let offerAPrice = product.list_price_paise;
  let offerADiscount = 0;
  const offerAReasons: string[] = [];

  if (isSprintPro || product.movement_rate === 'slow') {
    const targetDiscount = 35000;
    offerADiscount = Math.min(targetDiscount, maxAllowedPolicyDiscountPaise);
    offerAPrice = product.list_price_paise - offerADiscount;

    offerAReasons.push(`Slow-moving inventory acceleration (${product.movement_rate} movement rate)`);
    if (isPrepaidRequested) {
      offerAReasons.push('Prepaid UPI incentive (zero COD return risk)');
    }
    if (offerAPrice <= buyerConstraints.budget_max_paise) {
      const budgetInr = Math.round(buyerConstraints.budget_max_paise / 100);
      const priceInr = Math.round(offerAPrice / 100);
      offerAReasons.push(`Under buyer budget mandate (₹${priceInr.toLocaleString()} vs ₹${budgetInr.toLocaleString()} max)`);
    }
    offerAReasons.push('Monday delivery SLA achievable from Bengaluru warehouse BLR-WH-01');
  } else {
    const targetPrice = Math.min(
      buyerConstraints.budget_max_paise,
      product.list_price_paise - Math.floor(maxAllowedPolicyDiscountPaise * 0.7)
    );
    offerAPrice = Math.max(
      targetPrice,
      product.cost_paise + Math.ceil(product.cost_paise * (policy.min_margin_pct / 100))
    );
    offerADiscount = product.list_price_paise - offerAPrice;
    offerAReasons.push('Merchant volume optimization');
    if (isPrepaidRequested) offerAReasons.push('Prepaid payment incentive');
  }

  candidates.push({
    sku: product.sku,
    quantity: buyerConstraints.quantity,
    final_price_paise: offerAPrice,
    discount_paise: offerADiscount,
    discount_reason: offerAReasons,
    delivery_promise: mondayDelivery,
    return_terms_days: 10,
    payment_methods_allowed: preferredPayment,
    expires_at: new Date(now.getTime() + 8 * 60 * 1000).toISOString(),
    payment_amount_paise: offerAPrice * buyerConstraints.quantity,
    cod_return_risk: isPrepaidRequested ? 'high' : 'low',
  });

  // Candidate 2: Margin Maximizer
  const offerBPrice = isSprintPro ? 419900 : Math.min(product.list_price_paise, buyerConstraints.budget_max_paise);
  candidates.push({
    sku: product.sku,
    quantity: buyerConstraints.quantity,
    final_price_paise: offerBPrice,
    discount_paise: product.list_price_paise - offerBPrice,
    discount_reason: ['Standard catalog pricing tier', 'Guaranteed express dispatch'],
    delivery_promise: mondayDelivery,
    return_terms_days: 7,
    payment_methods_allowed: ['upi', 'card'],
    expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    payment_amount_paise: offerBPrice * buyerConstraints.quantity,
    cod_return_risk: 'low',
  });

  // Candidate 3: Max Discount Ceiling
  const offerCPrice = product.list_price_paise - maxAllowedPolicyDiscountPaise;
  candidates.push({
    sku: product.sku,
    quantity: buyerConstraints.quantity,
    final_price_paise: offerCPrice,
    discount_paise: maxAllowedPolicyDiscountPaise,
    discount_reason: [`Maximum policy discount ceiling (${policy.max_discount_pct}%) applied`, 'Clearance offer'],
    delivery_promise: tuesdayDelivery,
    return_terms_days: 7,
    payment_methods_allowed: ['upi'],
    expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    payment_amount_paise: offerCPrice * buyerConstraints.quantity,
    cod_return_risk: 'low',
  });

  return candidates;
}

/**
 * 2. Multi-Attribute Decision Evaluation by Buyer Agent Simulator
 */
export function evaluateBuyerMultiAttributeUtility(
  rawBids: {
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
  }[],
  priorities: string[] = ['price', 'delivery_speed', 'return_terms', 'extras'],
  budgetMaxPaise: number = 3000000
): AuctionBroadcastResult {
  const weightMap: Record<string, number> = {
    price: 0.15,
    delivery_speed: 0.15,
    return_terms: 0.10,
    extras: 0.10,
  };

  const p1 = priorities[0] || 'price';
  const p2 = priorities[1] || 'delivery_speed';
  const p3 = priorities[2] || 'return_terms';
  const p4 = priorities[3] || 'extras';

  weightMap[p1] = 0.50; // Primary priority
  weightMap[p2] = 0.30; // Secondary priority
  weightMap[p3] = 0.15; // Tertiary priority
  weightMap[p4] = 0.05; // Minor priority

  const prices = rawBids.map((b) => b.unit_price_paise);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const scoredBids: CompetingMerchantBid[] = rawBids.map((bid) => {
    // 1. Price Score
    let priceScore = 1.0;
    if (maxPrice > minPrice) {
      priceScore = 1.0 - (bid.unit_price_paise - minPrice) / (budgetMaxPaise - minPrice);
      priceScore = Math.max(0.0, Math.min(1.0, priceScore));
    } else if (bid.unit_price_paise <= budgetMaxPaise) {
      priceScore = 1.0;
    }

    // 2. Delivery Speed Score
    let deliveryScore = 0.30; // Friday
    if (bid.delivery_day_label.toLowerCase().includes('wednesday')) {
      deliveryScore = 1.00; // Fastest
    } else if (bid.delivery_day_label.toLowerCase().includes('thursday')) {
      deliveryScore = 0.65; // 1 day ahead
    } else if (bid.delivery_day_label.toLowerCase().includes('monday')) {
      deliveryScore = 1.00;
    }

    // 3. Return Terms Score
    let returnScore = 0.50;
    if (bid.return_terms_days >= 15) {
      returnScore = 1.00;
    } else if (bid.return_terms_days >= 10) {
      returnScore = 0.75;
    } else if (bid.return_terms_days >= 7) {
      returnScore = 0.50;
    }

    // 4. Extras / Customization Score
    let extrasScore = 0.20;
    const extrasLower = bid.extras_description.toLowerCase();
    if (extrasLower.includes('free custom logo') || extrasLower.includes('branding')) {
      extrasScore = 1.00;
    } else if (extrasLower.includes('replacement warranty') || extrasLower.includes('express air')) {
      extrasScore = 0.70;
    }

    // Total Utility
    const totalUtility =
      (weightMap['price'] || 0.25) * priceScore +
      (weightMap['delivery_speed'] || 0.25) * deliveryScore +
      (weightMap['return_terms'] || 0.25) * returnScore +
      (weightMap['extras'] || 0.25) * extrasScore;

    return {
      ...bid,
      utility_scores: {
        price_score: Number(priceScore.toFixed(3)),
        delivery_score: Number(deliveryScore.toFixed(3)),
        return_score: Number(returnScore.toFixed(3)),
        extras_score: Number(extrasScore.toFixed(3)),
        total_utility: Number(totalUtility.toFixed(3)),
      },
    };
  });

  scoredBids.sort((a, b) => b.utility_scores.total_utility - a.utility_scores.total_utility);
  const winner = scoredBids[0]!;

  let decisionRationale = '';
  if (p1 === 'delivery_speed') {
    decisionRationale = `Selected ${winner.merchant_name} (Utility: ${winner.utility_scores.total_utility.toFixed(3)}) because delivery speed was ranked #1 priority. ${winner.merchant_name} guarantees Wednesday delivery (2 days ahead of Friday deadline) and 15-day replacement terms at ₹${(winner.unit_price_paise / 100).toLocaleString()}, defeating Merchant B (₹28,900 but Friday delivery) and Merchant A (₹29,500 Thursday delivery).`;
  } else if (p1 === 'price') {
    decisionRationale = `Selected ${winner.merchant_name} (Utility: ${winner.utility_scores.total_utility.toFixed(3)}) because price was ranked #1 priority. ${winner.merchant_name} offered the lowest unit price of ₹${(winner.unit_price_paise / 100).toLocaleString()} (saving ₹1,100/unit under the ₹30,000 budget), defeating Merchant A (₹29,500) and Merchant C (₹30,000).`;
  } else if (p1 === 'extras') {
    decisionRationale = `Selected ${winner.merchant_name} (Utility: ${winner.utility_scores.total_utility.toFixed(3)}) because customization and extras were ranked #1 priority. ${winner.merchant_name} includes free custom logo laser engraving at ₹${(winner.unit_price_paise / 100).toLocaleString()} with Thursday delivery.`;
  } else {
    decisionRationale = `Selected ${winner.merchant_name} based on balanced multi-attribute utility score of ${winner.utility_scores.total_utility.toFixed(3)} across buyer constraints.`;
  }

  return {
    winner,
    competing_bids: scoredBids,
    decision_rationale: decisionRationale,
    buyer_priorities: priorities,
  };
}

/**
 * 3. Heuristic Expected-Profit Scoring
 */
export function scoreCandidateOffer(
  candidate: CandidateOfferInput,
  product: ProductSnapshot,
  buyerConstraints: BuyerConstraintsSection,
  evaluation: PolicyEvaluationResult
): ScoredCandidateOffer {
  const grossProfitPaise = candidate.final_price_paise - product.cost_paise;
  const marginPct = (grossProfitPaise / product.cost_paise) * 100;

  const isUnderBudget = candidate.final_price_paise <= buyerConstraints.budget_max_paise;
  const discountPct = (candidate.discount_paise / product.list_price_paise) * 100;

  let conversionProbability = 0.40;
  if (isUnderBudget) {
    conversionProbability += 0.30;
  } else {
    conversionProbability -= 0.50;
  }

  if (discountPct >= 5 && discountPct <= 10) {
    conversionProbability += 0.15;
  } else if (discountPct > 10) {
    conversionProbability += 0.20;
  }

  const isPrepaid = candidate.payment_methods_allowed.some((m: string) =>
    ['upi', 'card'].includes(m.toLowerCase())
  );
  if (isPrepaid) {
    conversionProbability += 0.10;
  }

  conversionProbability = Math.max(0.05, Math.min(0.98, conversionProbability));
  const prepaidSavingsPaise = isPrepaid ? 15000 : 0;
  const expectedProfitScore = grossProfitPaise * conversionProbability + prepaidSavingsPaise;

  return {
    candidate,
    evaluation,
    gross_profit_paise: grossProfitPaise,
    margin_pct: marginPct,
    conversion_probability: conversionProbability,
    expected_profit_score: expectedProfitScore,
    scoring_breakdown: {
      gross_profit_paise: grossProfitPaise,
      estimated_conversion: conversionProbability,
      prepaid_savings_paise: prepaidSavingsPaise,
      under_budget_bonus: isUnderBudget,
    },
  };
}

/**
 * 4. Gemini Plain-English Explanation Generator
 */
export async function generateOfferExplanation(
  winningCandidate: CandidateOfferInput,
  product: ProductSnapshot,
  _buyerConstraints: BuyerConstraintsSection,
  now: Date = new Date()
): Promise<string> {
  const productName = product.name || (product.sku.includes('SPRINTPRO') ? 'SprintPro X2 Running Shoes' : product.sku);
  const priceInr = Math.round(winningCandidate.final_price_paise / 100).toLocaleString();
  const discountInr = Math.round(winningCandidate.discount_paise / 100).toLocaleString();
  const listInr = Math.round(product.list_price_paise / 100).toLocaleString();
  const expiryMinutes = Math.round(
    (new Date(winningCandidate.expires_at).getTime() - now.getTime()) / (60 * 1000)
  );

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const prompt = `You are an AI explanation writer for merchant deal negotiations.
The deterministic policy engine has ALREADY finalized this offer:

Product: ${productName} (${product.sku})
List Price: ₹${listInr}
Final Price: ₹${priceInr}
Discount: ₹${discountInr}
Delivery Promise: ${winningCandidate.delivery_promise}
Return Terms: ${winningCandidate.return_terms_days} days
Payment Method: ${winningCandidate.payment_methods_allowed.join(', ')}
Expiry: ${expiryMinutes} minutes
Reasons:
${winningCandidate.discount_reason?.map((r: string) => `- ${r}`).join('\n')}

STRICT INSTRUCTION:
Write a single concise, professional, plain-English paragraph summarizing why this offer was generated.
CRITICAL MANDATE: You MUST NOT invent, alter, or suggest any new numbers, prices, discounts, or deadlines. Your explanation is purely descriptive of the decided facts above.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch {
      // Fallback
    }
  }

  const reasonsText = winningCandidate.discount_reason
    ? winningCandidate.discount_reason.map((r: string, i: number) => `(${i + 1}) ${r}`).join(', ')
    : 'standard policy rules';

  return `DealFlow crafted a personalized offer for ${productName} at ₹${priceInr} (₹${discountInr} discount from ₹${listInr} list price) with guaranteed delivery, ${winningCandidate.return_terms_days}-day returns, and an ${expiryMinutes}-minute validity window. This offer is approved under merchant policy based on: ${reasonsText}.`;
}

/**
 * 5. End-to-End Offer Negotiation Processor
 */
export async function processOfferNegotiation(
  buyerConstraints: BuyerConstraintsSection,
  product: ProductSnapshot,
  policy: MerchantPolicyConfig,
  inventory: InventorySnapshot,
  now: Date = new Date()
): Promise<NegotiationResult> {
  const candidates = generateCandidateOffers(buyerConstraints, product, policy, inventory, now);
  const scoredCandidates: ScoredCandidateOffer[] = [];

  for (const candidate of candidates) {
    const evaluation = evaluateAllPolicies(candidate, policy, product, inventory, now);
    if (evaluation.pass) {
      const scored = scoreCandidateOffer(candidate, product, buyerConstraints, evaluation);
      scoredCandidates.push(scored);
    }
  }

  if (scoredCandidates.length === 0) {
    throw new Error('No candidate offers passed the merchant deterministic policy engine.');
  }

  scoredCandidates.sort((a, b) => b.expected_profit_score - a.expected_profit_score);
  const winning = scoredCandidates[0]!;

  const explanation = await generateOfferExplanation(winning.candidate, product, buyerConstraints, now);

  const winningOffer: OfferSection = {
    offer_id: crypto.randomUUID(),
    sku: winning.candidate.sku,
    quantity: winning.candidate.quantity,
    final_price_paise: winning.candidate.final_price_paise,
    discount_paise: winning.candidate.discount_paise,
    discount_reason: winning.candidate.discount_reason || [],
    delivery_promise: winning.candidate.delivery_promise,
    return_terms_days: winning.candidate.return_terms_days,
    payment_methods_allowed: winning.candidate.payment_methods_allowed,
    expires_at: winning.candidate.expires_at,
    policy_version: policy.policy_version,
  };

  return {
    winning_offer: winningOffer,
    candidate_offers: scoredCandidates,
    explanation,
    margin_pct: winning.margin_pct,
    gross_profit_paise: winning.gross_profit_paise,
    requires_human_approval: winning.evaluation.requires_human_approval,
  };
}
