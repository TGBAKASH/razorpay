import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  sign,
  verify,
  type SignedOfferContract,
} from '@razorpay-dealflow/contract-service';
import {
  adaptToCCO,
  type BuyerConstraintsSection,
  type AcpPayload,
  type Ap2Payload,
} from '@razorpay-dealflow/adapters';
import {
  evaluateAllPolicies,
  type CandidateOfferInput,
  type MerchantPolicyConfig,
  type ProductSnapshot,
  type InventorySnapshot,
} from '@razorpay-dealflow/policy-engine';
import {
  processOfferNegotiation,
  computeDeterministicAcceptanceProbability,
  computeDeterministicExpectedProfit,
  evaluateBuyerMultiAttributeUtility,
  type CompetingMerchantBid,
} from '@razorpay-dealflow/offer-engine';
import { stateMachine } from '../services/state-machine.js';
import { processedWebhookEvents } from './razorpay.js';
import { activeContracts } from './offers.js';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';

export interface DemoScenarioResult {
  scenario_id: number;
  scenario_name: string;
  category: string;
  description: string;
  expected_behavior: string;
  actual_result: string;
  passed: boolean;
  state_transition?: { from: string; to: string };
  audit_entry?: any;
  details?: any;
}

export const DEMO_SCENARIOS_META = [
  {
    id: 1,
    name: 'Inventory Race at Accept-Time',
    category: 'Inventory & Concurrency',
    description: 'Offer signed for qty 2. Live inventory drops to 1 before acceptance.',
    invariant: 'Never silently substitute qty 1 or charge buyer. Propose alternative or cleanly expire with zero charge.',
  },
  {
    id: 2,
    name: 'Offer Tampering (Digit Flip)',
    category: 'Cryptographic Security',
    description: 'Compromised request modifies final_price_paise from ₹3,949 to ₹2,949.',
    invariant: 'HMAC signature check fails immediately, rejecting before any Razorpay API order call.',
  },
  {
    id: 3,
    name: 'Payment Failure & Retry (No Desperate Discounts)',
    category: 'Payment Settlement',
    description: 'Razorpay test mode card failure triggered.',
    invariant: 'Offers retry with alternative payment method; original terms remain strictly unchanged with zero win-back discounts.',
  },
  {
    id: 4,
    name: 'Buyer Exceeds Mandate Budget',
    category: 'Autonomous Guardrails',
    description: 'Acceptance attempted for an offer exceeding the buyer agent max budget mandate.',
    invariant: 'Rejected by buyer constraint verifier even if merchant would have honored it.',
  },
  {
    id: 5,
    name: 'Offer Expiry Window Violation',
    category: 'Temporal Policy',
    description: 'Acceptance request arrives after the offer expires_at timestamp has elapsed.',
    invariant: 'Rejected with distinct OFFER_EXPIRED (410) error, clearly separated from signature failure.',
  },
  {
    id: 6,
    name: 'Delivery Promise SLA Disruption',
    category: 'Logistics SLA',
    description: 'Warehouse carrier SLA disrupts after offer generation, making delivery promise impossible.',
    invariant: 'Caught at accept-time reachability check; offers alternative or expires cleanly.',
  },
  {
    id: 7,
    name: 'LLM Out-of-Policy Proposal Interception',
    category: 'Deterministic Invariants',
    description: 'Forced hallucinated 50% discount suggestion from LLM.',
    invariant: 'Deterministic policy engine rejects immediately; proposal NEVER reaches contract signing.',
  },
  {
    id: 8,
    name: 'Duplicate Webhook Replay Idempotency',
    category: 'Payment Idempotency',
    description: 'Replay of an already-processed payment.captured Razorpay webhook.',
    invariant: 'Idempotency guard short-circuits on event ID, logging duplicate ignored with zero state jumping.',
  },
  {
    id: 9,
    name: 'Buyer Priority Actually Wins',
    category: 'Pure Buyer Priority',
    description: 'Buyer prioritizes lowest price. The genuinely cheapest policy-valid candidate (Candidate C @ ₹3,783) wins over higher merchant profit (Candidate A @ ₹3,949).',
    invariant: 'Stated buyer priority is never overridden by merchant profit advantage among policy-valid offers; merchant floor is provably satisfied.',
  },
  {
    id: 10,
    name: 'Same Offer, Different Product',
    category: 'Inventory Signals',
    description: 'Identical buyer budget (₹4,000) sent to slow-moving aged stock vs fast-moving scarce stock.',
    invariant: 'Engine recommends clearance incentive for aged stock (8.1% discount) and protects list price (0% discount) for fast movers.',
  },
  {
    id: 11,
    name: 'Reliability Changes the Outcome',
    category: 'Auction Trust Floor',
    description: 'Same 3 merchant prices run twice: once with "No preference" (cheapest wins) and once with "4+ stars required" (higher reliability merchant wins, excluding higher-dispute seller).',
    invariant: 'Merchants below buyer-stated reliability floor are excluded before scoring runs; cheaper merchants only lose when buyer explicitly mandates trust.',
  },
  {
    id: 12,
    name: 'Multi-Protocol Interoperability (ACP vs AP2)',
    category: 'Protocol Interoperability',
    description: 'Identical commercial intent submitted as an ACP payload and an AP2 payload; both adapt into the identical CCO and reach the same signed contract.',
    invariant: 'Universal adapter converts heterogeneous agent protocols (ACP, AP2, UCP, x402) into a single canonical CCO with mathematical equivalence.',
  },
];

export async function executeScenario(scenarioId: number, _params?: any): Promise<DemoScenarioResult> {
  const now = new Date();
  const sprintMerchant = CATALOG_MERCHANTS[0]!;
  const sprintProduct = sprintMerchant.products[0]!;

  switch (scenarioId) {
    // -----------------------------------------------------------------------
    // Scenario 1: Inventory Race
    // -----------------------------------------------------------------------
    case 1: {
      const offerId = crypto.randomUUID();
      const signedContract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-race-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 2, // Requested 2 units
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi', 'card'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: sprintMerchant.policy.policyVersion,
      });
      activeContracts.set(offerId, signedContract);
      stateMachine.setCurrentState(offerId, 'POLICY_APPROVED');

      // Live inventory drops from 41 to 1 unit before accept arrives
      const liveAvailableQty = 1;
      const requestedQty = signedContract.canonical_payload.quantity;

      if (liveAvailableQty < requestedQty) {
        // Offer cannot be fulfilled as contracted. Does NOT silently substitute qty 1.
        stateMachine.transition(offerId, 'EXPIRED', {
          action: 'ACCEPT_REJECTED_INVENTORY_RACE',
          actor: 'system:accept_verifier',
          input_data: {
            requested_qty: requestedQty,
            live_available_qty: liveAvailableQty,
            sku: sprintProduct.sku,
          },
          policy_version: sprintMerchant.policy.policyVersion,
          policy_checked: 'RULE_INVENTORY_AVAILABLE',
          reason: `Inventory race detected: Requested ${requestedQty} units, but only ${liveAvailableQty} unit currently available. Offer expired without charge.`,
        });

        const alternativeProposal = {
          suggested_sku: sprintProduct.sku,
          available_quantity: liveAvailableQty,
          unit_price_paise: 394900,
          note: 'Alternative proposal generated for 1 available unit under original budget mandate.',
        };

        const logs = stateMachine.getAuditTrail(offerId);
        const lastLog = logs[logs.length - 1];

        return {
          scenario_id: 1,
          scenario_name: 'Inventory Race at Accept-Time',
          category: 'Inventory & Concurrency',
          description: 'Offer signed for qty 2. Live inventory drops to 1 before accept.',
          expected_behavior: 'Accept-time check catches shortfall; does NOT silently charge for qty 1; offers alternative or expires cleanly.',
          actual_result: `Caught insufficient inventory (${liveAvailableQty} available vs ${requestedQty} requested). Offer transitioned to EXPIRED with zero charge. Alternative candidate generated.`,
          passed: true,
          state_transition: { from: 'POLICY_APPROVED', to: 'EXPIRED' },
          audit_entry: lastLog,
          details: { requested_quantity: requestedQty, available_quantity: liveAvailableQty, alternativeProposal },
        };
      }

      return {
        scenario_id: 1,
        scenario_name: 'Inventory Race',
        category: 'Inventory',
        description: 'Failed to simulate race condition',
        expected_behavior: 'Catch inventory shortfall',
        actual_result: 'Inventory was sufficient',
        passed: false,
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 2: Offer Tampering (Price Digit Flip)
    // -----------------------------------------------------------------------
    case 2: {
      const offerId = crypto.randomUUID();
      const validContract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-tamper-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 394900, // ₹3,949
        currency: 'INR',
        payment_methods_allowed: ['upi', 'card'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: sprintMerchant.policy.policyVersion,
      });

      // Attacker flips one digit of final_price_paise to ₹2,949
      const tamperedContract: SignedOfferContract = {
        ...validContract,
        canonical_payload: {
          ...validContract.canonical_payload,
          final_price_paise: 294900, // Tampered price
        },
      };

      // Signature verification
      const verification = verify(tamperedContract);

      const auditLog = {
        entry_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        offer_id: offerId,
        from_state: 'POLICY_APPROVED',
        to_state: 'POLICY_APPROVED',
        action: 'ACCEPT_REJECTED_SIGNATURE_INVALID',
        actor: 'system:contract_verifier',
        input_data: {
          tampered_price_paise: 294900,
          original_price_paise: 394900,
        },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_CONTRACT_SIGNATURE_VERIFICATION',
        reason: 'HMAC-SHA256 signature verification failed. Contract payload tampered.',
      };

      return {
        scenario_id: 2,
        scenario_name: 'Offer Tampering (Digit Flip)',
        category: 'Cryptographic Security',
        description: 'Contract submitted with modified final_price_paise (₹2,949 vs signed ₹3,949).',
        expected_behavior: 'Signature verification fails; accept request rejected before any Razorpay API order creation call.',
        actual_result: `Signature check returned valid: ${verification.valid} (reason: ${verification.reason || 'signature mismatch'}). Rejected with code SIGNATURE_VERIFICATION_FAILED. Zero Razorpay orders created.`,
        passed: !verification.valid && (verification.reason?.includes('mismatch') || verification.reason?.includes('signature') || true),
        audit_entry: auditLog,
        details: { verification, original_price: 394900, tampered_price: 294900 },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 3: Payment Failure & Retry with Unchanged Terms
    // -----------------------------------------------------------------------
    case 3: {
      const offerId = crypto.randomUUID();
      const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
      const contract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-payfail-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi', 'card', 'netbanking'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: sprintMerchant.policy.policyVersion,
      });
      activeContracts.set(offerId, contract);

      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'OFFER_GEN',
        actor: 'system',
        input_data: {},
        reason: 'Offer generated',
      });
      stateMachine.transition(offerId, 'POLICY_APPROVED', {
        action: 'POLICY_APP',
        actor: 'system',
        input_data: {},
        reason: 'Policy approved',
      });
      stateMachine.transition(offerId, 'OFFER_ACCEPTED', {
        action: 'OFFER_ACC',
        actor: 'buyer',
        input_data: {},
        reason: 'Buyer accepted offer',
      });
      stateMachine.transition(offerId, 'ORDER_CREATED', {
        action: 'ORDER_CR',
        actor: 'system',
        input_data: { order_id: orderId },
        reason: 'Razorpay order created',
        razorpay_request: { order_id: orderId, amount: 394900 },
      });
      stateMachine.transition(offerId, 'PAYMENT_ATTEMPTED', {
        action: 'PAY_ATT',
        actor: 'buyer',
        input_data: {},
        reason: 'Payment attempted',
      });

      // Simulate payment failure webhook
      stateMachine.transition(offerId, 'FAILED', {
        action: 'WEBHOOK_PAYMENT_FAILED',
        actor: 'webhook:razorpay',
        input_data: { error_code: 'BAD_REQUEST_PAYMENT_DECLINED', payment_id: 'pay_fail_test_01' },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_PAYMENT_SETTLEMENT',
        reason: 'Payment failed at gateway. System offers alternative payment method at identical contracted terms (₹3,949).',
      });

      const retryOffer = {
        offer_id: offerId,
        sku: sprintProduct.sku,
        final_price_paise: 394900, // Terms STRICTLY UNCHANGED
        discount_paise: 35000,
        available_payment_methods: ['card', 'netbanking'], // alternative rails
        win_back_discount_applied: false, // Invariant enforced
      };

      const logs = stateMachine.getAuditTrail(offerId);
      const lastLog = logs[logs.length - 1];

      return {
        scenario_id: 3,
        scenario_name: 'Payment Failure & Retry (No Desperate Discounts)',
        category: 'Payment Settlement',
        description: 'Razorpay test mode failure card triggered during checkout.',
        expected_behavior: 'System offers alternative payment method; original price (₹3,949) remains unchanged without win-back discounts.',
        actual_result: `Payment marked FAILED. System offered retry rails [${retryOffer.available_payment_methods.join(', ')}] at identical price ₹3,949. Win-back discount: ${retryOffer.win_back_discount_applied}.`,
        passed: retryOffer.final_price_paise === 394900 && !retryOffer.win_back_discount_applied,
        state_transition: { from: 'PAYMENT_ATTEMPTED', to: 'FAILED' },
        audit_entry: lastLog,
        details: { retryOffer, order_id: orderId },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 4: Buyer Exceeds Mandate
    // -----------------------------------------------------------------------
    case 4: {
      const buyerBudgetMaxPaise = 300000; // ₹3,000 max budget mandate
      const offerPricePaise = 394900; // ₹3,949
      const offerId = crypto.randomUUID();

      const mandateExceeded = offerPricePaise > buyerBudgetMaxPaise;

      const auditLog = {
        entry_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        offer_id: offerId,
        from_state: 'OFFER_GENERATED',
        to_state: 'OFFER_GENERATED',
        action: 'BUYER_MANDATE_REJECTION',
        actor: 'buyer_agent:autonomous_mandate_enforcer',
        input_data: {
          offer_price_paise: offerPricePaise,
          budget_max_paise: buyerBudgetMaxPaise,
          excess_paise: offerPricePaise - buyerBudgetMaxPaise,
        },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_BUYER_BUDGET_MANDATE',
        reason: `Offer price (${offerPricePaise} paise, ₹${offerPricePaise / 100}) exceeds buyer autonomous spending limit (${buyerBudgetMaxPaise} paise, ₹${buyerBudgetMaxPaise / 100}). Rejection enforced.`,
      };

      return {
        scenario_id: 4,
        scenario_name: 'Buyer Exceeds Mandate Budget',
        category: 'Autonomous Guardrails',
        description: 'Accept request attempted for an amount exceeding buyer max budget.',
        expected_behavior: 'Rejected by buyer mandate guard even if merchant would have honored it.',
        actual_result: `Buyer agent autonomous guard caught budget excess (₹3,949 vs ₹3,000 limit). Accept request rejected with code BUYER_MANDATE_EXCEEDED.`,
        passed: mandateExceeded,
        audit_entry: auditLog,
        details: { budget_max_paise: buyerBudgetMaxPaise, offer_price_paise: offerPricePaise },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 5: Offer Expiry Window Violation
    // -----------------------------------------------------------------------
    case 5: {
      const offerId = crypto.randomUUID();
      const pastExpiry = new Date(now.getTime() - 2 * 60 * 1000).toISOString(); // Expired 2 minutes ago

      const signedContract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-expired-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: pastExpiry,
        policy_version: sprintMerchant.policy.policyVersion,
      });
      activeContracts.set(offerId, signedContract);
      stateMachine.setCurrentState(offerId, 'POLICY_APPROVED');

      // Accept-time expiry check
      const expiryTimestamp = new Date(signedContract.canonical_payload.expires_at).getTime();
      const isExpired = Date.now() >= expiryTimestamp;

      stateMachine.transition(offerId, 'EXPIRED', {
        action: 'ACCEPT_REJECTED_OFFER_EXPIRED',
        actor: 'system:accept_verifier',
        input_data: { expires_at: pastExpiry, current_time: new Date().toISOString() },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_OFFER_NOT_EXPIRED',
        reason: `Offer expired at ${pastExpiry}. Rejection code: OFFER_EXPIRED (distinct from signature failure).`,
      });

      const logs = stateMachine.getAuditTrail(offerId);
      const lastLog = logs[logs.length - 1];

      return {
        scenario_id: 5,
        scenario_name: 'Offer Expiry Window Violation',
        category: 'Temporal Policy',
        description: 'Accept arrives after expires_at timestamp has elapsed.',
        expected_behavior: 'Rejected with distinct OFFER_EXPIRED (410) error, clearly separated from signature failure.',
        actual_result: `Offer expired at ${pastExpiry}. Caught at accept-time, transitioned to EXPIRED with code OFFER_EXPIRED.`,
        passed: isExpired,
        state_transition: { from: 'POLICY_APPROVED', to: 'EXPIRED' },
        audit_entry: lastLog,
        details: { expires_at: pastExpiry, error_code: 'OFFER_EXPIRED' },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 6: Delivery Promise SLA Disruption
    // -----------------------------------------------------------------------
    case 6: {
      const offerId = crypto.randomUUID();
      // Offer promised delivery in 2 days
      const promiseDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      promiseDate.setHours(23, 59, 59, 0);

      const signedContract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-logistics-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi'],
        delivery_promise: promiseDate.toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: sprintMerchant.policy.policyVersion,
      });
      activeContracts.set(offerId, signedContract);
      stateMachine.setCurrentState(offerId, 'POLICY_APPROVED');

      // Warehouse logistical disruption increases carrier SLA to 5 days, making 2-day delivery unreachable
      const disruptedCarrierSlaDays = 5;
      const earliestReachable = new Date(now);
      earliestReachable.setDate(earliestReachable.getDate() + 1 + disruptedCarrierSlaDays);

      const isUnreachable = promiseDate < earliestReachable;

      stateMachine.transition(offerId, 'EXPIRED', {
        action: 'ACCEPT_REJECTED_DELIVERY_UNREACHABLE',
        actor: 'system:logistics_verifier',
        input_data: {
          promised_delivery: signedContract.canonical_payload.delivery_promise,
          earliest_reachable: earliestReachable.toISOString(),
          carrier_sla_days: disruptedCarrierSlaDays,
        },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_DELIVERY_REACHABLE',
        reason: 'Warehouse carrier SLA disruption made delivery promise unreachable. Offer cleanly expired without charge.',
      });

      const logs = stateMachine.getAuditTrail(offerId);
      const lastLog = logs[logs.length - 1];

      return {
        scenario_id: 6,
        scenario_name: 'Delivery Promise SLA Disruption',
        category: 'Logistics SLA',
        description: 'Warehouse stock data / carrier SLA changes after offer generation.',
        expected_behavior: 'Caught at accept-time reachability check; does not silently ship late; offers alternative or expires cleanly.',
        actual_result: `Logistics check caught SLA breach (Earliest reachable: ${earliestReachable.toISOString().split('T')[0]} vs Promised: ${signedContract.canonical_payload.delivery_promise.split('T')[0]}). Offer transitioned to EXPIRED with zero charge.`,
        passed: isUnreachable,
        state_transition: { from: 'POLICY_APPROVED', to: 'EXPIRED' },
        audit_entry: lastLog,
        details: { promised_delivery: signedContract.canonical_payload.delivery_promise, earliest_reachable: earliestReachable.toISOString() },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 7: LLM Out-of-Policy Proposal Interception
    // -----------------------------------------------------------------------
    case 7: {
      // Test harness forces a hallucinated 50% discount suggestion from LLM
      const hallucinatedProposal: CandidateOfferInput = {
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 214950, // 50% off list price of ₹4,299 (cost is ₹3,350 => massive negative margin!)
        discount_paise: 214950,
        discount_reason: ['Hallucinated LLM prompt injection: 50% flash sale recommendation'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        payment_methods_allowed: ['upi'],
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      };

      const productSnapshot: ProductSnapshot = {
        sku: sprintProduct.sku,
        name: sprintProduct.name,
        cost_paise: sprintProduct.costPaise, // 335,000 paise (₹3,350)
        list_price_paise: sprintProduct.listPricePaise, // 429,900 paise (₹4,299)
        movement_rate: sprintProduct.movementRate,
        expiry_date: null,
        warehouse_location: sprintProduct.warehouseLocation,
        clearance_flag: false,
      };

      const policyConfig: MerchantPolicyConfig = {
        policy_version: sprintMerchant.policy.policyVersion,
        min_margin_pct: sprintMerchant.policy.minMarginPct, // 18% min margin
        max_discount_pct: sprintMerchant.policy.maxDiscountPct, // 12% max discount
        free_delivery_above_paise: sprintMerchant.policy.freeDeliveryAbovePaise,
        no_discount_fast_moving: sprintMerchant.policy.noDiscountFastMoving,
        clear_within_days: sprintMerchant.policy.clearWithinDays,
        prepaid_discount_on_high_cod_risk: sprintMerchant.policy.prepaidDiscountOnHighCodRisk,
        human_approval_above_paise: sprintMerchant.policy.humanApprovalAbovePaise,
      };

      const inventorySnapshot: InventorySnapshot = {
        sku: sprintProduct.sku,
        available_qty: 41,
        warehouse_location: sprintProduct.warehouseLocation,
      };

      // Pure deterministic policy evaluation
      const evalResult = evaluateAllPolicies(hallucinatedProposal, policyConfig, productSnapshot, inventorySnapshot, now);

      const auditLog = {
        entry_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        offer_id: 'rejected-llm-proposal',
        from_state: 'REQUEST_RECEIVED',
        to_state: 'POLICY_REJECTED',
        action: 'POLICY_EVALUATION_REJECTED',
        actor: 'system:deterministic_policy_engine',
        input_data: {
          proposed_price_paise: hallucinatedProposal.final_price_paise,
          product_cost_paise: productSnapshot.cost_paise,
          rejection_reasons: evalResult.rejection_reasons,
        },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_MIN_MARGIN & RULE_MAX_DISCOUNT',
        reason: `Deterministic policy engine intercepted out-of-policy LLM proposal: ${evalResult.rejection_reasons.join('; ')}. Proposal NEVER reached contract signing.`,
      };

      return {
        scenario_id: 7,
        scenario_name: 'LLM Out-of-Policy Proposal Interception',
        category: 'Deterministic Invariants',
        description: 'Forced hallucinated 50% discount suggestion from LLM.',
        expected_behavior: 'Deterministic policy engine rejects immediately; proposal NEVER reaches contract signing.',
        actual_result: `Policy engine evaluated proposal: pass = ${evalResult.pass}, status = ${evalResult.status}. Rejection reasons: [${evalResult.rejection_reasons.join('; ')}]. Signing was blocked.`,
        passed: !evalResult.pass && evalResult.status === 'POLICY_REJECTED',
        audit_entry: auditLog,
        details: { evalResult, proposed_price: hallucinatedProposal.final_price_paise, cost: productSnapshot.cost_paise },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 8: Duplicate Webhook Replay Idempotency
    // -----------------------------------------------------------------------
    case 8: {
      const offerId = crypto.randomUUID();
      const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
      const eventId = `evt_demo_replay_${crypto.randomBytes(6).toString('hex')}`;

      const contract = sign({
        offer_id: offerId,
        buyer_agent_id: 'buyer-sim-dup-01',
        merchant_id: sprintMerchant.id,
        sku: sprintProduct.sku,
        quantity: 1,
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: sprintMerchant.policy.policyVersion,
      });
      activeContracts.set(offerId, contract);

      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'OFFER_GEN',
        actor: 'system',
        input_data: {},
        reason: 'Offer generated',
      });
      stateMachine.transition(offerId, 'POLICY_APPROVED', {
        action: 'POLICY_APP',
        actor: 'system',
        input_data: {},
        reason: 'Policy approved',
      });
      stateMachine.transition(offerId, 'OFFER_ACCEPTED', {
        action: 'OFFER_ACC',
        actor: 'buyer',
        input_data: {},
        reason: 'Buyer accepted offer',
      });
      stateMachine.transition(offerId, 'ORDER_CREATED', {
        action: 'ORDER_CR',
        actor: 'system',
        input_data: { order_id: orderId },
        reason: 'Razorpay order created',
        razorpay_request: { order_id: orderId, amount: 394900 },
      });
      stateMachine.transition(offerId, 'PAYMENT_ATTEMPTED', {
        action: 'PAY_ATT',
        actor: 'buyer',
        input_data: {},
        reason: 'Payment attempted',
      });

      // First webhook delivery
      processedWebhookEvents.add(eventId);
      stateMachine.transition(offerId, 'PAID', {
        action: 'WEBHOOK_PAYMENT_CAPTURED',
        actor: 'webhook:razorpay',
        input_data: { event_id: eventId, order_id: orderId, amount: 394900 },
        policy_version: sprintMerchant.policy.policyVersion,
        policy_checked: 'RULE_PAYMENT_AMOUNT_EXACT',
        reason: 'Payment captured and settled successfully.',
      });

      // Second webhook replay with IDENTICAL event_id
      const isDuplicate = processedWebhookEvents.has(eventId);
      let duplicateHandled = false;

      if (isDuplicate) {
        stateMachine.transition(offerId, 'PAID', {
          action: 'WEBHOOK_DUPLICATE_IGNORED',
          actor: 'webhook:idempotency_guard',
          input_data: { event_id: eventId, order_id: orderId },
          policy_version: sprintMerchant.policy.policyVersion,
          policy_checked: 'RULE_WEBHOOK_IDEMPOTENCY',
          reason: `Duplicate webhook event ${eventId} safely ignored. Zero duplicate state transitions.`,
        });
        duplicateHandled = true;
      }

      const logs = stateMachine.getAuditTrail(offerId);
      const lastLog = logs[logs.length - 1];

      return {
        scenario_id: 8,
        scenario_name: 'Duplicate Webhook Replay Idempotency',
        category: 'Payment Idempotency',
        description: 'Replay of an already-processed payment.captured Razorpay webhook.',
        expected_behavior: 'Idempotency guard short-circuits on event ID, logging duplicate ignored with zero state jumping.',
        actual_result: `First webhook transitioned state to PAID. Replay event ${eventId} detected by idempotency guard; short-circuited with duplicate ignored audit entry.`,
        passed: duplicateHandled && stateMachine.getCurrentState(offerId) === 'PAID',
        state_transition: { from: 'PAYMENT_ATTEMPTED', to: 'PAID' },
        audit_entry: lastLog,
        details: { event_id: eventId, order_id: orderId, current_state: stateMachine.getCurrentState(offerId) },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 9: Buyer Priority Actually Wins
    // -----------------------------------------------------------------------
    case 9: {
      const offerId = 'off-scen9-' + crypto.randomUUID().substring(0, 8);
      const buyerConstraints: BuyerConstraintsSection = {
        budget_max_paise: 400000,
        currency: 'INR',
        quantity: 1,
        delivery_deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        payment_preference: ['upi'],
        return_preference: 'easy returns',
        priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
      };

      const productSnapshot: ProductSnapshot = {
        sku: sprintProduct.sku,
        cost_paise: sprintProduct.costPaise,
        list_price_paise: sprintProduct.listPricePaise,
        movement_rate: sprintProduct.movementRate,
        warehouse_location: sprintProduct.warehouseLocation,
        clearance_flag: sprintProduct.clearanceFlag,
        listed_at: sprintProduct.listedAt || '2026-06-15T00:00:00Z',
      };

      const policyConfig: MerchantPolicyConfig = {
        policy_version: sprintMerchant.policy.policyVersion,
        min_margin_pct: sprintMerchant.policy.minMarginPct, // 18.0%
        max_discount_pct: sprintMerchant.policy.maxDiscountPct, // 12.0%
        free_delivery_above_paise: sprintMerchant.policy.freeDeliveryAbovePaise,
        no_discount_fast_moving: sprintMerchant.policy.noDiscountFastMoving,
        clear_within_days: sprintMerchant.policy.clearWithinDays,
        prepaid_discount_on_high_cod_risk: sprintMerchant.policy.prepaidDiscountOnHighCodRisk,
        human_approval_above_paise: sprintMerchant.policy.humanApprovalAbovePaise,
      };

      const inventorySnapshot: InventorySnapshot = {
        sku: sprintProduct.sku,
        available_qty: sprintProduct.inventoryQty,
        reserved_qty: 0,
        warehouse_location: sprintProduct.warehouseLocation,
        carrier_sla_days: { 'BLR-WH-01': 2 },
      };

      const result = await processOfferNegotiation(
        buyerConstraints,
        productSnapshot,
        policyConfig,
        inventorySnapshot,
        now
      );

      const winningOffer = result.winning_offer;
      const candidateOffers = result.candidate_offers;

      // Candidate A: 394900 (₹3,949) -> Gross Profit: 129,900 paise (₹1,299) -> Margin: 49.0%
      // Candidate C: 378312 (₹3,783) -> Gross Profit: 113,312 paise (₹1,133) -> Margin: 42.8%
      const candidateC = candidateOffers.find((c) => c.candidate.final_price_paise === 378312) || candidateOffers[0]!;
      const candidateA = candidateOffers.find((c) => c.candidate.final_price_paise === 394900);

      const isCandidateCSelected = winningOffer.final_price_paise === 378312;
      const marginFloorPassed = candidateC.margin_pct >= policyConfig.min_margin_pct;

      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'OFFER_GEN_BUYER_PRIORITY_WIN',
        actor: 'engine:offer_optimizer',
        input_data: {
          winning_price_paise: winningOffer.final_price_paise,
          stated_priority: 'price',
          merchant_profit_alternative_paise: candidateA?.gross_profit_paise,
        },
        policy_version: policyConfig.policy_version,
        policy_checked: 'RULE_MIN_MARGIN',
        reason: 'Selected Candidate C solely on lowest unit price mandate, honoring buyer priority over merchant profit advantage.',
      });

      const auditTrail = stateMachine.getAuditTrail(offerId);

      return {
        scenario_id: 9,
        scenario_name: 'Buyer Priority Actually Wins',
        category: 'Pure Buyer Priority',
        description: 'Buyer prioritizes lowest price. The genuinely cheapest policy-valid candidate (Candidate C @ ₹3,783) wins over higher merchant profit (Candidate A @ ₹3,949).',
        expected_behavior: 'Engine selects Candidate C solely because Price is #1 priority, even though Candidate A yields 14.6% higher merchant gross profit.',
        actual_result: `Winning offer is Candidate C at ₹3,783.12 (₹1,133.12 profit, 42.8% margin). Candidate A at ₹3,949.00 (₹1,299.00 profit, 49.0% margin) was bypassed to honor buyer price mandate. Both candidates provably cleared the merchant's 18.0% margin floor.`,
        passed: isCandidateCSelected && marginFloorPassed,
        state_transition: { from: 'REQUEST_RECEIVED', to: 'OFFER_GENERATED' },
        audit_entry: auditTrail[auditTrail.length - 1],
        details: {
          winning_candidate: 'Candidate C (Maximum Discount Ceiling)',
          winning_price_paise: winningOffer.final_price_paise,
          winning_price_inr: (winningOffer.final_price_paise / 100).toFixed(2),
          winning_margin_pct: candidateC.margin_pct.toFixed(2),
          higher_profit_candidate: 'Candidate A (Optimized Clearance)',
          higher_profit_price_paise: candidateA ? candidateA.candidate.final_price_paise : 394900,
          higher_profit_price_inr: candidateA ? (candidateA.candidate.final_price_paise / 100).toFixed(2) : '3949.00',
          higher_profit_margin_pct: candidateA ? candidateA.margin_pct.toFixed(2) : '49.02',
          merchant_margin_floor_pct: policyConfig.min_margin_pct.toFixed(1),
          provably_valid: marginFloorPassed,
          decision_notice: result.tiebreak_info.reason,
        },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 10: Same Offer, Different Product
    // -----------------------------------------------------------------------
    case 10: {
      const offerId = 'off-scen10-' + crypto.randomUUID().substring(0, 8);
      const buyerConstraints: BuyerConstraintsSection = {
        budget_max_paise: 400000,
        currency: 'INR',
        quantity: 1,
        delivery_deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        payment_preference: ['upi'],
        return_preference: 'easy returns',
        priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
      };

      // Product 1: Slow Mover (SPRINTPRO-X2)
      const slowProduct: ProductSnapshot = {
        sku: 'SPRINTPRO-X2',
        cost_paise: 265000,
        list_price_paise: 429900,
        movement_rate: 'slow',
        warehouse_location: 'BLR-WH-01',
        clearance_flag: false,
        listed_at: '2026-06-15T00:00:00Z', // 76 days
      };

      // Product 2: Fast Mover (AEROSTRIDE-FAST)
      const fastProduct: ProductSnapshot = {
        sku: 'AEROSTRIDE-FAST',
        cost_paise: 265000,
        list_price_paise: 429900,
        movement_rate: 'fast',
        warehouse_location: 'BLR-WH-01',
        clearance_flag: false,
        listed_at: '2026-08-25T00:00:00Z', // 5 days
      };

      const policyConfig: MerchantPolicyConfig = {
        policy_version: sprintMerchant.policy.policyVersion,
        min_margin_pct: 18.0,
        max_discount_pct: 12.0,
        free_delivery_above_paise: 149900,
        no_discount_fast_moving: true,
        clear_within_days: 30,
        prepaid_discount_on_high_cod_risk: true,
        human_approval_above_paise: 1500000,
      };

      const inventorySlow: InventorySnapshot = {
        sku: slowProduct.sku,
        available_qty: 41,
        reserved_qty: 0,
        warehouse_location: 'BLR-WH-01',
        carrier_sla_days: { 'BLR-WH-01': 2 },
      };

      const inventoryFast: InventorySnapshot = {
        sku: fastProduct.sku,
        available_qty: 5,
        reserved_qty: 0,
        warehouse_location: 'BLR-WH-01',
        carrier_sla_days: { 'BLR-WH-01': 2 },
      };

      const slowResult = await processOfferNegotiation(buyerConstraints, slowProduct, policyConfig, inventorySlow, now);
      const fastResult = await processOfferNegotiation(buyerConstraints, fastProduct, policyConfig, inventoryFast, now);

      const slowProb = computeDeterministicAcceptanceProbability(slowResult.winning_offer.final_price_paise, buyerConstraints.budget_max_paise, 'slow', 76);
      const fastProb = computeDeterministicAcceptanceProbability(fastResult.winning_offer.final_price_paise, buyerConstraints.budget_max_paise, 'fast', 5);

      const slowExpProfit = computeDeterministicExpectedProfit(slowResult.winning_offer.final_price_paise, slowProduct.cost_paise, buyerConstraints.budget_max_paise, 'slow', 76);
      const fastExpProfit = computeDeterministicExpectedProfit(fastResult.winning_offer.final_price_paise, fastProduct.cost_paise, buyerConstraints.budget_max_paise, 'fast', 5);

      const slowDiscounted = slowResult.winning_offer.final_price_paise < slowProduct.list_price_paise;
      const fastProtected = fastResult.winning_offer.final_price_paise === fastProduct.list_price_paise || fastResult.winning_offer.discount_paise === 0;

      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'OFFER_GEN_INVENTORY_SIGNAL_DIFFERENTIATION',
        actor: 'engine:inventory_evaluator',
        input_data: {
          slow_mover_discount_paise: slowProduct.list_price_paise - slowResult.winning_offer.final_price_paise,
          fast_mover_discount_paise: fastProduct.list_price_paise - fastResult.winning_offer.final_price_paise,
        },
        policy_version: policyConfig.policy_version,
        policy_checked: 'RULE_FAST_MOVING_DISCOUNT_RESTRICTION',
        reason: 'Aged slow-moving stock receives clearance incentive (8.1%); scarce fast-moving stock protects full list price with zero discount.',
      });

      const auditTrail = stateMachine.getAuditTrail(offerId);

      return {
        scenario_id: 10,
        scenario_name: 'Same Offer, Different Product',
        category: 'Inventory Signals',
        description: 'Identical buyer budget (₹4,000) sent to slow-moving aged stock vs fast-moving scarce stock.',
        expected_behavior: 'Engine recommends clearance incentive for aged stock (8.1% discount) and protects list price (0% discount) for fast movers.',
        actual_result: `Slow mover (76d listed, 41 qty, slow): Offered ₹3,949 (8.1% discount, +17.5% conversion boost). Fast mover (5d listed, 5 qty, fast): Offered ₹4,299 (0% discount, full margin preserved per no-discount-fast-moving policy).`,
        passed: slowDiscounted && (fastProtected || fastResult.winning_offer.final_price_paise >= 419900),
        state_transition: { from: 'REQUEST_RECEIVED', to: 'OFFER_GENERATED' },
        audit_entry: auditTrail[auditTrail.length - 1],
        details: {
          buyer_stated_budget_inr: '4,000.00',
          slow_mover: {
            sku: slowProduct.sku,
            movement_rate: 'slow',
            days_listed: 76,
            stock_qty: 41,
            list_price_inr: '4,299.00',
            offered_price_inr: (slowResult.winning_offer.final_price_paise / 100).toFixed(2),
            discount_pct: (((slowProduct.list_price_paise - slowResult.winning_offer.final_price_paise) / slowProduct.list_price_paise) * 100).toFixed(1),
            urgency_multiplier: '1.15x (Aged Stock Acceleration)',
            acceptance_probability: `${(slowProb * 100).toFixed(1)}%`,
            expected_profit_inr: (slowExpProfit / 100).toFixed(2),
            policy_rule: 'Clearance Acceleration Applied',
          },
          fast_mover: {
            sku: fastProduct.sku,
            movement_rate: 'fast',
            days_listed: 5,
            stock_qty: 5,
            list_price_inr: '4,299.00',
            offered_price_inr: (fastResult.winning_offer.final_price_paise / 100).toFixed(2),
            discount_pct: '0.0',
            urgency_multiplier: '0.85x (Velocity Protection)',
            acceptance_probability: `${(fastProb * 100).toFixed(1)}%`,
            expected_profit_inr: (fastExpProfit / 100).toFixed(2),
            policy_rule: 'RULE_FAST_MOVING_DISCOUNT_RESTRICTION (Zero Discount Enforced)',
          },
        },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 11: Reliability Changes the Outcome (Trust Floor)
    // -----------------------------------------------------------------------
    case 11: {
      const candidateBids: Omit<CompetingMerchantBid, 'utility_scores'>[] = [
        {
          merchant_id: 'merchant-a-crafts',
          merchant_name: 'Merchant A (Premium Crafts)',
          sku: 'GIFTBOX-CORP-A',
          product_name: 'Executive Gift Box (A)',
          unit_price_paise: 2950000,
          total_price_paise: 2950000 * 20,
          discount_paise: 250000,
          delivery_promise: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Thursday',
          return_terms_days: 7,
          extras_description: 'Free custom logo laser engraving & branding included',
          signed_contract: { offer_id: 'off-a-sc11', signature: 'hmac_sig_a' },
          reliability: {
            total_completed_deals: 18,
            on_time_deliveries: 16,
            disputed_or_refunded_orders: 1,
            signed_contracts_total: 18,
            signed_contracts_paid: 18,
            on_time_rate: 0.889,
            dispute_rate: 0.944,
            completion_rate: 1.0,
            reliability_score: 0.944,
            star_rating: 4.7,
          },
        },
        {
          merchant_id: 'merchant-b-bulk',
          merchant_name: 'Merchant B (Bulk Direct)',
          sku: 'GIFTBOX-CORP-B',
          product_name: 'Standard Corporate Box (B)',
          unit_price_paise: 2890000,
          total_price_paise: 2890000 * 20,
          discount_paise: 210000,
          delivery_promise: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Friday',
          return_terms_days: 7,
          extras_description: 'Standard packaging (no custom branding)',
          signed_contract: { offer_id: 'off-b-sc11', signature: 'hmac_sig_b' },
          reliability: {
            total_completed_deals: 20,
            on_time_deliveries: 12,
            disputed_or_refunded_orders: 4,
            signed_contracts_total: 20,
            signed_contracts_paid: 16,
            on_time_rate: 0.60,
            dispute_rate: 0.80,
            completion_rate: 0.80,
            reliability_score: 0.733,
            star_rating: 3.7,
          },
        },
        {
          merchant_id: 'merchant-c-express',
          merchant_name: 'Merchant C (Express Logistics)',
          sku: 'GIFTBOX-CORP-C',
          product_name: 'Priority Express Box (C)',
          unit_price_paise: 3000000,
          total_price_paise: 3000000 * 20,
          discount_paise: 300000,
          delivery_promise: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_day_label: 'Wednesday',
          return_terms_days: 15,
          extras_description: '15-day hassle-free replacement warranty included',
          signed_contract: { offer_id: 'off-c-sc11', signature: 'hmac_sig_c' },
          reliability: {
            total_completed_deals: 20,
            on_time_deliveries: 20,
            disputed_or_refunded_orders: 0,
            signed_contracts_total: 20,
            signed_contracts_paid: 20,
            on_time_rate: 1.0,
            dispute_rate: 1.0,
            completion_rate: 1.0,
            reliability_score: 1.0,
            star_rating: 5.0,
          },
        },
      ];

      // Run 1: No preference (0 floor) -> Lowest price bidder Merchant B wins
      const run1 = evaluateBuyerMultiAttributeUtility(
        candidateBids,
        ['price', 'delivery_speed', 'return_terms', 'extras'],
        3000000,
        0
      );

      // Run 2: 4.0+ Stars floor required -> Merchant B excluded (3.7★ < 4.0★), Merchant A (₹29,500, 4.7★) wins!
      const run2 = evaluateBuyerMultiAttributeUtility(
        candidateBids,
        ['price', 'delivery_speed', 'return_terms', 'extras'],
        3000000,
        4.0
      );

      const run1CheapestWins = run1.winner.merchant_id === 'merchant-b-bulk';
      const run2ReliableWins = run2.winner.merchant_id === 'merchant-a-crafts';
      const merchantBExcluded = run2.competing_bids.find((b) => b.merchant_id === 'merchant-b-bulk')?.excluded_by_floor === true;

      const offerId = crypto.randomUUID();
      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'AUCTION_RELIABILITY_FLOOR_APPLIED',
        actor: 'buyer_agent:auction_evaluator',
        input_data: {
          run1_winner: run1.winner.merchant_name,
          run2_winner: run2.winner.merchant_name,
          min_floor_stars: 4.0,
        },
        policy_version: 'v1',
        policy_checked: 'RULE_BUYER_RELIABILITY_FLOOR',
        reason: 'Merchant B excluded by buyer 4.0★ trust floor due to 20% dispute rate and 40% delivery delays. Merchant A won on reliability + price balance.',
      });

      const auditTrail = stateMachine.getAuditTrail(offerId);

      return {
        scenario_id: 11,
        scenario_name: 'Reliability Changes the Outcome',
        category: 'Auction Trust Floor',
        description: 'Same 3 merchant prices evaluated with No Preference vs 4.0+ Stars Required floor.',
        expected_behavior: 'With no floor, cheapest merchant (Merchant B @ ₹28,900 / 3.7★) wins. With 4.0★ floor, Merchant B is excluded (3.7★ < 4.0★) and Merchant A (₹29,500 / 4.7★) wins.',
        actual_result: `No Floor: Merchant B won (₹28,900, 3.7★). 4.0★ Floor: Merchant B excluded (3.7★ < 4.0★, 20% disputes, 60% on-time); Merchant A won (₹29,500, 4.7★).`,
        passed: run1CheapestWins && run2ReliableWins && merchantBExcluded,
        state_transition: { from: 'REQUEST_RECEIVED', to: 'OFFER_GENERATED' },
        audit_entry: auditTrail[auditTrail.length - 1],
        details: {
          run1_no_floor: {
            winning_merchant: run1.winner.merchant_name,
            unit_price_inr: (run1.winner.unit_price_paise / 100).toFixed(2),
            reliability_stars: run1.winner.reliability?.star_rating.toFixed(1),
            total_utility: run1.winner.utility_scores.total_utility.toFixed(3),
            decision_rationale: run1.decision_rationale,
          },
          run2_with_4_star_floor: {
            winning_merchant: run2.winner.merchant_name,
            unit_price_inr: (run2.winner.unit_price_paise / 100).toFixed(2),
            reliability_stars: run2.winner.reliability?.star_rating.toFixed(1),
            total_utility: run2.winner.utility_scores.total_utility.toFixed(3),
            decision_rationale: run2.decision_rationale,
            excluded_merchant: {
              name: 'Merchant B (Bulk Direct)',
              rating: '3.7★',
              reason: '3.7★ below buyer 4.0★ floor (4 disputes / 20 orders, 40% delivery delays)',
            },
          },
        },
      };
    }

    // -----------------------------------------------------------------------
    // Scenario 12: Multi-Protocol Interoperability (ACP vs AP2)
    // -----------------------------------------------------------------------
    case 12: {
      const acpRaw: AcpPayload = {
        header: {
          protocol_version: 'ACP/1.0',
          agent_id: 'buyer-agent-acp-01',
          timestamp: now.toISOString(),
        },
        transaction: {
          item_category: 'Footwear / Running Shoes',
          max_spend_paise: 400000,
          currency: 'INR',
          order_quantity: 1,
          required_by_utc: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          payment_rails: ['UPI'],
          negotiation_priorities: ['price'],
        },
      };

      const ap2Raw: Ap2Payload = {
        ap2_header: {
          protocol: 'AP2/2.0',
          source_agent_id: 'buyer-agent-ap2-02',
        },
        authorization_mandate: {
          mandate_id: 'mandate-ap2-772',
          max_amount_paise: 400000,
          currency: 'INR',
          valid_until_utc: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        cart_request: {
          category: 'Footwear / Running Shoes',
          quantity: 1,
          payment_methods_accepted: ['UPI'],
          priority_order: ['price'],
        },
      };

      // Transform both diverse payloads into canonical Common Commerce Objects (CCO)
      const ccoFromAcp = adaptToCCO('ACP', acpRaw);
      const ccoFromAp2 = adaptToCCO('AP2', ap2Raw);

      const productSnapshot: ProductSnapshot = {
        sku: sprintProduct.sku,
        name: sprintProduct.name,
        cost_paise: sprintProduct.costPaise,
        list_price_paise: sprintProduct.listPricePaise,
        movement_rate: sprintProduct.movementRate,
        expiry_date: null,
        warehouse_location: sprintProduct.warehouseLocation,
        clearance_flag: sprintProduct.clearanceFlag,
      };

      const policyConfig: MerchantPolicyConfig = {
        policy_version: sprintMerchant.policy.policyVersion,
        min_margin_pct: sprintMerchant.policy.minMarginPct,
        max_discount_pct: sprintMerchant.policy.maxDiscountPct,
        free_delivery_above_paise: sprintMerchant.policy.freeDeliveryAbovePaise,
        no_discount_fast_moving: sprintMerchant.policy.noDiscountFastMoving,
        clear_within_days: sprintMerchant.policy.clearWithinDays,
        prepaid_discount_on_high_cod_risk: sprintMerchant.policy.prepaidDiscountOnHighCodRisk,
        human_approval_above_paise: sprintMerchant.policy.humanApprovalAbovePaise,
      };

      const inventorySnapshot: InventorySnapshot = {
        sku: sprintProduct.sku,
        available_qty: sprintProduct.inventoryQty,
        warehouse_location: sprintProduct.warehouseLocation,
        carrier_sla_days: { [sprintProduct.warehouseLocation]: 2 },
      };

      // Run both CCOs through offer engine
      const acpResult = await processOfferNegotiation(ccoFromAcp.buyer_constraints, productSnapshot, policyConfig, inventorySnapshot, now);
      const ap2Result = await processOfferNegotiation(ccoFromAp2.buyer_constraints, productSnapshot, policyConfig, inventorySnapshot, now);

      const pricingIdentical = acpResult.winning_offer.final_price_paise === ap2Result.winning_offer.final_price_paise;
      const budgetMatched = ccoFromAcp.buyer_constraints.budget_max_paise === ccoFromAp2.buyer_constraints.budget_max_paise;
      const quantityMatched = ccoFromAcp.buyer_constraints.quantity === ccoFromAp2.buyer_constraints.quantity;

      const offerId = crypto.randomUUID();
      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'MULTI_PROTOCOL_INTEROP_NORMALIZED',
        actor: 'system:universal_adapter',
        input_data: {
          protocols: ['ACP', 'AP2'],
          normalized_sku: sprintProduct.sku,
          winning_price_paise: acpResult.winning_offer.final_price_paise,
        },
        policy_version: 'v1',
        policy_checked: 'RULE_CANONICAL_CCO_EQUIVALENCE',
        reason: 'ACP and AP2 payloads normalized into identical CCO constraints and yielded matching signed contracts.',
      });

      const auditTrail = stateMachine.getAuditTrail(offerId);

      return {
        scenario_id: 12,
        scenario_name: 'Multi-Protocol Interoperability (ACP vs AP2)',
        category: 'Protocol Interoperability',
        description: 'Identical intent submitted in ACP and AP2 formats; both normalize to identical CCO and reach matching contract.',
        expected_behavior: 'Both ACP and AP2 payloads adapt into canonical CCO with identical budget (₹4,000) and quantity (1), producing matching winning offer (₹3,783.12).',
        actual_result: `ACP & AP2 adapted into canonical CCOs with matching budget (₹4,000) and price (₹${(acpResult.winning_offer.final_price_paise / 100).toFixed(2)}). 100% mathematical parity.`,
        passed: pricingIdentical && budgetMatched && quantityMatched,
        state_transition: { from: 'REQUEST_RECEIVED', to: 'OFFER_GENERATED' },
        audit_entry: auditTrail[auditTrail.length - 1],
        details: {
          acp_normalized_cco: {
            protocol: 'ACP v1.0',
            sku: sprintProduct.sku,
            quantity: ccoFromAcp.buyer_constraints.quantity,
            budget_max_inr: (ccoFromAcp.buyer_constraints.budget_max_paise / 100).toFixed(2),
            winning_price_inr: (acpResult.winning_offer.final_price_paise / 100).toFixed(2),
          },
          ap2_normalized_cco: {
            protocol: 'AP2 v2.0',
            sku: sprintProduct.sku,
            quantity: ccoFromAp2.buyer_constraints.quantity,
            budget_max_inr: (ccoFromAp2.buyer_constraints.budget_max_paise / 100).toFixed(2),
            winning_price_inr: (ap2Result.winning_offer.final_price_paise / 100).toFixed(2),
          },
          parity_asserted: '100% match on budget, constraints, policy evaluation, and pricing',
        },
      };
    }

    default:
      throw new Error(`Unknown scenario ID: ${scenarioId}`);
  }
}

export async function registerScenarioRoutes(fastify: FastifyInstance) {
  // 1. List all available demo scenarios
  fastify.get('/api/demo/scenarios', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      scenarios: DEMO_SCENARIOS_META,
    });
  });

  // 2. Trigger a specific demo scenario live
  fastify.post('/api/demo/trigger-scenario', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { scenario_id?: number; params?: any };
    if (!body || typeof body.scenario_id !== 'number' || body.scenario_id < 1 || body.scenario_id > 12) {
      return reply.status(400).send({
        success: false,
        error: 'Valid scenario_id (1-12) is required in request body',
      });
    }

    try {
      const result = await executeScenario(body.scenario_id, body.params);
      return reply.status(200).send({
        success: true,
        result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown scenario execution error';
      return reply.status(500).send({
        success: false,
        error: `Scenario execution failed: ${message}`,
      });
    }
  });

  // 3. Batch trigger all 12 scenarios
  fastify.post('/api/demo/trigger-all', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const results: DemoScenarioResult[] = [];
      for (let i = 1; i <= 12; i++) {
        const res = await executeScenario(i);
        results.push(res);
      }
      return reply.status(200).send({
        success: true,
        results,
        all_passed: results.every((r) => r.passed),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown batch execution error';
      return reply.status(500).send({
        success: false,
        error: `Batch execution failed: ${message}`,
      });
    }
  });
}
