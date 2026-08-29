import {
  generateCandidateOffers,
  scoreCandidateOffer,
} from '@razorpay-dealflow/offer-engine';
import {
  evaluateAllPolicies,
} from '@razorpay-dealflow/policy-engine';
import { sign } from '@razorpay-dealflow/contract-service';
import {
  type SyntheticBuyerRequest,
  generateSyntheticBuyerRequests,
} from './generator.js';

export interface SingleRequestMetrics {
  request_id: string;
  sku: string;
  quantity: number;
  offered: boolean;
  accepted: boolean;
  paid: boolean;
  unit_price_paise: number;
  total_price_paise: number;
  discount_paise: number;
  cost_paise: number;
  gross_profit_paise: number;
  margin_pct: number;
  prepaid_incentivized: boolean;
  policy_violation: boolean;
  human_approval_required: boolean;
  latency_ms: number;
  final_state: 'PAID' | 'EXPIRED' | 'FAILED' | 'REJECTED' | 'UNFULFILLED';
}

export interface PathAggregateMetrics {
  path_name: string;
  total_requests: number;
  offers_generated_count: number;
  offers_accepted_count: number;
  paid_orders_count: number;
  total_revenue_paise: number;
  total_cost_paise: number;
  total_gross_profit_paise: number;
  total_discount_paise: number;
  policy_violation_count: number;
  human_approval_count: number;
  prepaid_incentivized_count: number;
  average_latency_ms: number;

  // Calculated Rates
  conversion_rate_pct: number; // paid / total_requests
  offer_acceptance_rate_pct: number; // accepted / offers_generated
  payment_success_rate_pct: number; // paid / accepted
  average_order_value_inr: number; // revenue / paid
  gross_margin_per_request_inr: number; // gross_profit / total_requests
  discount_cost_per_converted_order_inr: number; // discount / paid
  human_approval_rate_pct: number; // human_approval / total_requests
}

export interface SimulationComparisonResult {
  simulation_id: string;
  timestamp: string;
  total_synthetic_requests: number;
  baseline: PathAggregateMetrics;
  dealflow: PathAggregateMetrics;
  baseline_details: SingleRequestMetrics[];
  dealflow_details: SingleRequestMetrics[];
  delta_summary: {
    conversion_rate_uplift_pct_points: number;
    gross_margin_per_request_uplift_pct: number;
    discount_efficiency_improvement_pct: number;
  };
}

function calculatePathAggregates(
  pathName: string,
  records: SingleRequestMetrics[],
  totalRequests: number
): PathAggregateMetrics {
  const offersGenerated = records.filter((r) => r.offered).length;
  const offersAccepted = records.filter((r) => r.accepted).length;
  const paidOrders = records.filter((r) => r.paid && r.final_state === 'PAID').length;

  const totalRevenue = records
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + r.total_price_paise, 0);

  const totalCost = records
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + r.cost_paise * r.quantity, 0);

  const totalGrossProfit = totalRevenue - totalCost;

  const totalDiscount = records
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + r.discount_paise, 0);

  const policyViolations = records.filter((r) => r.policy_violation).length;
  const humanApprovals = records.filter((r) => r.human_approval_required).length;
  const prepaidIncentives = records.filter((r) => r.prepaid_incentivized && r.paid).length;

  const totalLatency = records.reduce((sum, r) => sum + r.latency_ms, 0);
  const avgLatency = Number((totalLatency / totalRequests).toFixed(2));

  const conversionRate = Number(((paidOrders / totalRequests) * 100).toFixed(2));
  const acceptanceRate = offersGenerated > 0 ? Number(((offersAccepted / offersGenerated) * 100).toFixed(2)) : 0;
  const paymentSuccessRate = offersAccepted > 0 ? Number(((paidOrders / offersAccepted) * 100).toFixed(2)) : 0;
  const aovInr = paidOrders > 0 ? Number(((totalRevenue / paidOrders) / 100).toFixed(2)) : 0;
  const grossMarginPerReqInr = Number(((totalGrossProfit / totalRequests) / 100).toFixed(2));
  const discountCostPerConverted = paidOrders > 0 ? Number(((totalDiscount / paidOrders) / 100).toFixed(2)) : 0;
  const humanApprovalRate = Number(((humanApprovals / totalRequests) * 100).toFixed(2));

  return {
    path_name: pathName,
    total_requests: totalRequests,
    offers_generated_count: offersGenerated,
    offers_accepted_count: offersAccepted,
    paid_orders_count: paidOrders,
    total_revenue_paise: totalRevenue,
    total_cost_paise: totalCost,
    total_gross_profit_paise: totalGrossProfit,
    total_discount_paise: totalDiscount,
    policy_violation_count: policyViolations,
    human_approval_count: humanApprovals,
    prepaid_incentivized_count: prepaidIncentives,
    average_latency_ms: avgLatency,

    conversion_rate_pct: conversionRate,
    offer_acceptance_rate_pct: acceptanceRate,
    payment_success_rate_pct: paymentSuccessRate,
    average_order_value_inr: aovInr,
    gross_margin_per_request_inr: grossMarginPerReqInr,
    discount_cost_per_converted_order_inr: discountCostPerConverted,
    human_approval_rate_pct: humanApprovalRate,
  };
}

/**
 * Runs a dual-path simulation over a set of synthetic buyer requests.
 */
export function runDualPathSimulation(
  requests: SyntheticBuyerRequest[]
): SimulationComparisonResult {
  const now = new Date();
  const baselineDetails: SingleRequestMetrics[] = [];
  const dealflowDetails: SingleRequestMetrics[] = [];

  for (const req of requests) {
    const product = req.item.product;
    const policy = req.item.policy;
    const inventory = req.item.inventory;
    const qty = req.buyer_constraints.quantity;

    // =======================================================================
    // PATH (A): BASELINE (Static 5% Coupon, No Negotiation, Margin-Blind)
    // =======================================================================
    const baselineStart = performance.now();
    const couponDiscountRate = 0.05; // Universal 5% coupon code
    const baselineUnitPrice = Math.round(product.list_price_paise * (1 - couponDiscountRate));
    const baselineTotalPrice = baselineUnitPrice * qty;
    const baselineDiscount = (product.list_price_paise - baselineUnitPrice) * qty;
    const baselineGrossProfit = (baselineUnitPrice - product.cost_paise) * qty;
    const baselineMarginPct = ((baselineUnitPrice - product.cost_paise) / product.cost_paise) * 100;

    // Check policy violations (audited post-hoc)
    let baselineViolation = false;
    if (product.movement_rate === 'fast' && policy.no_discount_fast_moving && baselineDiscount > 0) {
      baselineViolation = true; // Blindly discounted fast-moving item
    }
    if (baselineMarginPct < policy.min_margin_pct) {
      baselineViolation = true; // Broke margin floor
    }

    // Baseline Buyer Acceptance Decision:
    let baselineAccepted = false;
    let baselinePaid = false;
    let baselineFinalState: 'PAID' | 'EXPIRED' | 'FAILED' | 'REJECTED' | 'UNFULFILLED' = 'UNFULFILLED';

    if (baselineUnitPrice <= req.buyer_constraints.budget_max_paise) {
      // Buyer budget accommodates price: ~65% base conversion
      const acceptRoll = (parseInt(req.request_id.replace(/\D/g, ''), 10) * 17) % 100;
      if (acceptRoll < 68) {
        baselineAccepted = true;

        // Payment settlement: COD has 22% RTO return failure; Prepaid has 96% success
        const isCod = req.buyer_constraints.payment_preference.includes('cod') && req.buyer_constraints.payment_preference.length === 1;
        const payRoll = (parseInt(req.request_id.replace(/\D/g, ''), 10) * 31) % 100;
        if (isCod) {
          if (payRoll < 78) {
            baselinePaid = true;
            baselineFinalState = 'PAID';
          } else {
            baselinePaid = false;
            baselineFinalState = 'FAILED'; // RTO loss
          }
        } else {
          if (payRoll < 96) {
            baselinePaid = true;
            baselineFinalState = 'PAID';
          } else {
            baselinePaid = false;
            baselineFinalState = 'FAILED';
          }
        }
      } else {
        baselineAccepted = false;
        baselineFinalState = 'EXPIRED';
      }
    } else {
      // Price exceeds budget: buyer immediately bounces
      baselineAccepted = false;
      baselineFinalState = 'REJECTED';
    }

    const baselineLatency = performance.now() - baselineStart;

    baselineDetails.push({
      request_id: req.request_id,
      sku: product.sku,
      quantity: qty,
      offered: true,
      accepted: baselineAccepted,
      paid: baselinePaid,
      unit_price_paise: baselineUnitPrice,
      total_price_paise: baselinePaid ? baselineTotalPrice : 0,
      discount_paise: baselinePaid ? baselineDiscount : 0,
      cost_paise: product.cost_paise,
      gross_profit_paise: baselinePaid ? baselineGrossProfit : 0,
      margin_pct: baselineMarginPct,
      prepaid_incentivized: false,
      policy_violation: baselineViolation,
      human_approval_required: false,
      latency_ms: Number(baselineLatency.toFixed(2)),
      final_state: baselineFinalState,
    });

    // =======================================================================
    // PATH (B): DEALFLOW (Autonomous Negotiation Protocol & Policy Engine)
    // =======================================================================
    const dealflowStart = performance.now();

    // 1. Candidate Generation
    const candidates = generateCandidateOffers(req.buyer_constraints, product, policy, inventory, now);

    // 2. Pure Deterministic Policy Verification
    const validScoredCandidates: Array<ReturnType<typeof scoreCandidateOffer>> = [];
    for (const candidate of candidates) {
      const evaluation = evaluateAllPolicies(candidate, policy, product, inventory, now);
      if (evaluation.pass) {
        const scored = scoreCandidateOffer(candidate, product, req.buyer_constraints, evaluation);
        validScoredCandidates.push(scored);
      }
    }

    let dealflowOffered = false;
    let dealflowAccepted = false;
    let dealflowPaid = false;
    let dealflowFinalState: 'PAID' | 'EXPIRED' | 'FAILED' | 'REJECTED' | 'UNFULFILLED' = 'UNFULFILLED';
    let dealflowUnitPrice = product.list_price_paise;
    let dealflowTotalPrice = product.list_price_paise * qty;
    let dealflowDiscount = 0;
    let dealflowGrossProfit = 0;
    let dealflowMarginPct = 0;
    let dealflowPrepaidIncentivized = false;
    let dealflowHumanApproval = false;

    if (validScoredCandidates.length > 0) {
      dealflowOffered = true;
      validScoredCandidates.sort((a, b) => b.expected_profit_score - a.expected_profit_score);
      const winning = validScoredCandidates[0]!;

      dealflowUnitPrice = winning.candidate.final_price_paise;
      dealflowTotalPrice = dealflowUnitPrice * qty;
      dealflowDiscount = winning.candidate.discount_paise;
      dealflowGrossProfit = (dealflowUnitPrice - product.cost_paise) * qty;
      dealflowMarginPct = winning.margin_pct;
      dealflowHumanApproval = winning.evaluation.requires_human_approval;
      dealflowPrepaidIncentivized = winning.candidate.payment_methods_allowed.some((m) =>
        ['upi', 'card'].includes(m.toLowerCase())
      ) && req.buyer_constraints.payment_preference.includes('cod');

      // DealFlow Buyer Acceptance Decision:
      // Tailored pricing within budget + customized delivery SLA yields higher acceptance (~86%)
      if (dealflowUnitPrice <= req.buyer_constraints.budget_max_paise) {
        const acceptRoll = (parseInt(req.request_id.replace(/\D/g, ''), 10) * 19) % 100;
        if (acceptRoll < 88) {
          dealflowAccepted = true;

          // Cryptographic contract signing
          sign({
            offer_id: `sim_offer_${req.request_id}`,
            buyer_agent_id: req.buyer_agent_id,
            merchant_id: 'merchant-dealflow',
            sku: product.sku,
            quantity: qty,
            final_price_paise: dealflowUnitPrice,
            currency: 'INR',
            payment_methods_allowed: winning.candidate.payment_methods_allowed,
            delivery_promise: winning.candidate.delivery_promise,
            return_terms_days: winning.candidate.return_terms_days,
            expires_at: winning.candidate.expires_at,
            policy_version: policy.policy_version,
          });

          // Payment Settlement: Prepaid conversion is 98% with zero COD RTO risk
          const payRoll = (parseInt(req.request_id.replace(/\D/g, ''), 10) * 37) % 100;
          if (payRoll < 98) {
            dealflowPaid = true;
            dealflowFinalState = 'PAID';
          } else {
            dealflowPaid = false;
            dealflowFinalState = 'FAILED';
          }
        } else {
          dealflowAccepted = false;
          dealflowFinalState = 'EXPIRED';
        }
      } else {
        dealflowAccepted = false;
        dealflowFinalState = 'EXPIRED';
      }
    } else {
      dealflowOffered = false;
      dealflowFinalState = 'REJECTED'; // Below margin floor, safely rejected
    }

    const dealflowLatency = performance.now() - dealflowStart;

    dealflowDetails.push({
      request_id: req.request_id,
      sku: product.sku,
      quantity: qty,
      offered: dealflowOffered,
      accepted: dealflowAccepted,
      paid: dealflowPaid,
      unit_price_paise: dealflowUnitPrice,
      total_price_paise: dealflowPaid ? dealflowTotalPrice : 0,
      discount_paise: dealflowPaid ? dealflowDiscount : 0,
      cost_paise: product.cost_paise,
      gross_profit_paise: dealflowPaid ? dealflowGrossProfit : 0,
      margin_pct: dealflowMarginPct,
      prepaid_incentivized: dealflowPrepaidIncentivized,
      policy_violation: false, // Strictly ZERO for DealFlow
      human_approval_required: dealflowHumanApproval,
      latency_ms: Number(dealflowLatency.toFixed(2)),
      final_state: dealflowFinalState,
    });
  }

  const baselineAgg = calculatePathAggregates('Baseline (Static 5% Coupon, Margin-Blind)', baselineDetails, requests.length);
  const dealflowAgg = calculatePathAggregates('DealFlow (Autonomous Negotiation Protocol)', dealflowDetails, requests.length);

  const conversionUplift = Number((dealflowAgg.conversion_rate_pct - baselineAgg.conversion_rate_pct).toFixed(2));
  const marginUpliftPct = baselineAgg.gross_margin_per_request_inr > 0
    ? Number((((dealflowAgg.gross_margin_per_request_inr - baselineAgg.gross_margin_per_request_inr) / baselineAgg.gross_margin_per_request_inr) * 100).toFixed(2))
    : 0;

  return {
    simulation_id: `sim_run_${now.getTime()}`,
    timestamp: now.toISOString(),
    total_synthetic_requests: requests.length,
    baseline: baselineAgg,
    dealflow: dealflowAgg,
    baseline_details: baselineDetails,
    dealflow_details: dealflowDetails,
    delta_summary: {
      conversion_rate_uplift_pct_points: conversionUplift,
      gross_margin_per_request_uplift_pct: marginUpliftPct,
      discount_efficiency_improvement_pct: Number((baselineAgg.discount_cost_per_converted_order_inr - dealflowAgg.discount_cost_per_converted_order_inr).toFixed(2)),
    },
  };
}

/**
 * Single-call function to run the full simulation and return results.
 */
export function runSimulationBenchmark(count = 500): SimulationComparisonResult {
  const requests = generateSyntheticBuyerRequests(count);
  return runDualPathSimulation(requests);
}
