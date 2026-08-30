export interface PolicyCheckResult {
  pass: boolean;
  reason: string;
  checked_rule: string;
}

export type OfferPolicyStatus = 'POLICY_APPROVED' | 'APPROVAL_PENDING' | 'POLICY_REJECTED';

export interface PolicyEvaluationResult {
  pass: boolean;
  status: OfferPolicyStatus;
  checks: PolicyCheckResult[];
  rejection_reasons: string[];
  requires_human_approval: boolean;
  policy_version: string;
}

export interface CandidateOfferInput {
  sku: string;
  quantity: number;
  final_price_paise: number;
  discount_paise: number;
  discount_reason?: string[];
  delivery_promise: string; // ISO8601 date string
  return_terms_days: number;
  payment_methods_allowed: string[];
  expires_at: string; // ISO8601 timestamp
  payment_method_selected?: string; // e.g. "upi", "card", "cod"
  payment_amount_paise?: number; // for payment matching check
  cod_return_risk?: 'low' | 'medium' | 'high';
}

export interface MerchantPolicyConfig {
  policy_version: string;
  min_margin_pct: number; // e.g. 18.0 means 18%
  max_discount_pct: number; // e.g. 12.0 means 12%
  free_delivery_above_paise: number; // e.g. 149900
  no_discount_fast_moving: boolean;
  clear_within_days: number; // e.g. 30
  prepaid_discount_on_high_cod_risk: boolean;
  human_approval_above_paise: number; // e.g. 1500000 (₹15,000)
}

export interface ProductSnapshot {
  sku: string;
  name?: string;
  cost_paise: number;
  list_price_paise: number;
  movement_rate: 'fast' | 'normal' | 'slow';
  expiry_date?: string | null;
  warehouse_location: string;
  clearance_flag: boolean;
  listed_at?: string | null;
}

export interface InventorySnapshot {
  sku: string;
  available_qty: number;
  reserved_qty?: number;
  warehouse_location: string;
  carrier_sla_days?: Record<string, number>; // e.g. { "BLR-WH-01": 2, "HYD-WH-01": 3 }
}

export const RULE_NAMES = {
  MIN_MARGIN: 'RULE_MIN_MARGIN',
  MAX_DISCOUNT: 'RULE_MAX_DISCOUNT',
  INVENTORY_AVAILABLE: 'RULE_INVENTORY_AVAILABLE',
  DELIVERY_REACHABLE: 'RULE_DELIVERY_REACHABLE',
  OFFER_NOT_EXPIRED: 'RULE_OFFER_NOT_EXPIRED',
  PAYMENT_AMOUNT_EXACT: 'RULE_PAYMENT_AMOUNT_EXACT',
  HUMAN_APPROVAL_THRESHOLD: 'RULE_HUMAN_APPROVAL_THRESHOLD',
  FAST_MOVING_DISCOUNT_RESTRICTION: 'RULE_FAST_MOVING_DISCOUNT_RESTRICTION',
  CLEARANCE_ELIGIBILITY: 'RULE_CLEARANCE_ELIGIBILITY',
  PREPAID_INCENTIVE: 'RULE_PREPAID_INCENTIVE',
} as const;

/**
 * 1. Margin Check:
 * final_price_paise >= cost_paise + ceil(cost_paise * min_margin_pct / 100)
 */
export function checkMinMargin(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  product: ProductSnapshot,
  _inventory: InventorySnapshot,
  _now: Date = new Date()
): PolicyCheckResult {
  const minRequiredMarginPaise = Math.ceil(product.cost_paise * (policy.min_margin_pct / 100));
  const minAllowedPricePaise = product.cost_paise + minRequiredMarginPaise;

  const actualMarginPaise = offer.final_price_paise - product.cost_paise;
  const actualMarginPct = (actualMarginPaise / product.cost_paise) * 100;

  if (offer.final_price_paise < minAllowedPricePaise) {
    return {
      pass: false,
      reason: `Proposed price (${offer.final_price_paise} paise) yields ${actualMarginPct.toFixed(2)}% margin, which violates required minimum margin of ${policy.min_margin_pct.toFixed(2)}% (minimum price: ${minAllowedPricePaise} paise).`,
      checked_rule: RULE_NAMES.MIN_MARGIN,
    };
  }

  return {
    pass: true,
    reason: `Proposed price (${offer.final_price_paise} paise) yields ${actualMarginPct.toFixed(2)}% margin, meeting the required ${policy.min_margin_pct.toFixed(2)}% margin.`,
    checked_rule: RULE_NAMES.MIN_MARGIN,
  };
}

/**
 * 2. Discount Ceiling Check:
 * discount_paise <= floor(list_price_paise * max_discount_pct / 100)
 */
export function checkMaxDiscount(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  product: ProductSnapshot,
  _inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyCheckResult {
  // If product is clearance eligible, discount ceiling can be overridden
  const clearance = checkClearanceEligibility(offer, policy, product, _inventory, now);
  if (clearance.pass && product.clearance_flag) {
    return {
      pass: true,
      reason: `Discount of ${offer.discount_paise} paise allowed under active clearance exemption.`,
      checked_rule: RULE_NAMES.MAX_DISCOUNT,
    };
  }

  const maxAllowedDiscountPaise = Math.floor(product.list_price_paise * (policy.max_discount_pct / 100));
  const proposedDiscountPct = (offer.discount_paise / product.list_price_paise) * 100;

  if (offer.discount_paise > maxAllowedDiscountPaise) {
    return {
      pass: false,
      reason: `Proposed discount (${offer.discount_paise} paise, ${proposedDiscountPct.toFixed(2)}%) exceeds the maximum allowable discount ceiling of ${policy.max_discount_pct.toFixed(2)}% (${maxAllowedDiscountPaise} paise).`,
      checked_rule: RULE_NAMES.MAX_DISCOUNT,
    };
  }

  return {
    pass: true,
    reason: `Proposed discount (${offer.discount_paise} paise, ${proposedDiscountPct.toFixed(2)}%) is within the ${policy.max_discount_pct.toFixed(2)}% ceiling.`,
    checked_rule: RULE_NAMES.MAX_DISCOUNT,
  };
}

/**
 * 3. Inventory Availability Check:
 * inventory_qty > 0 AND inventory_qty >= offer.quantity
 */
export function checkInventoryAvailability(
  offer: CandidateOfferInput,
  _policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  inventory: InventorySnapshot,
  _now: Date = new Date()
): PolicyCheckResult {
  if (inventory.available_qty <= 0) {
    return {
      pass: false,
      reason: `Out of stock: Available inventory is 0 units for SKU ${inventory.sku}.`,
      checked_rule: RULE_NAMES.INVENTORY_AVAILABLE,
    };
  }

  if (inventory.available_qty < offer.quantity) {
    return {
      pass: false,
      reason: `Insufficient inventory: Requested quantity is ${offer.quantity}, but only ${inventory.available_qty} units are available.`,
      checked_rule: RULE_NAMES.INVENTORY_AVAILABLE,
    };
  }

  return {
    pass: true,
    reason: `Inventory available: ${inventory.available_qty} units available for requested quantity of ${offer.quantity}.`,
    checked_rule: RULE_NAMES.INVENTORY_AVAILABLE,
  };
}

/**
 * 4. Delivery Promise Reachability Check:
 * Checks warehouse SLA and carrier promise date.
 */
export function checkDeliveryReachable(
  offer: CandidateOfferInput,
  _policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyCheckResult {
  const promiseDate = new Date(offer.delivery_promise);
  if (isNaN(promiseDate.getTime())) {
    return {
      pass: false,
      reason: `Invalid delivery promise date format: ${offer.delivery_promise}.`,
      checked_rule: RULE_NAMES.DELIVERY_REACHABLE,
    };
  }

  // Calculate earliest delivery SLA (warehouse prep 1 day + carrier SLA)
  const carrierSlaDays = inventory.carrier_sla_days?.[inventory.warehouse_location] ?? 2;
  const minRequiredDays = 1 + carrierSlaDays; // 1 prep day + carrier transit

  const earliestReachableDate = new Date(now);
  earliestReachableDate.setDate(earliestReachableDate.getDate() + minRequiredDays);
  earliestReachableDate.setHours(0, 0, 0, 0);

  const testPromiseDate = new Date(promiseDate);
  testPromiseDate.setHours(23, 59, 59, 999);

  if (testPromiseDate < earliestReachableDate) {
    return {
      pass: false,
      reason: `Delivery promise (${offer.delivery_promise}) is unreachable. Earliest reachable date for ${inventory.warehouse_location} is ${earliestReachableDate.toISOString().split('T')[0]}.`,
      checked_rule: RULE_NAMES.DELIVERY_REACHABLE,
    };
  }

  return {
    pass: true,
    reason: `Delivery promise (${offer.delivery_promise}) is reachable with ${inventory.warehouse_location} SLA.`,
    checked_rule: RULE_NAMES.DELIVERY_REACHABLE,
  };
}

/**
 * 5. Offer Expiry Check:
 * offer.expires_at > now()
 */
export function checkOfferNotExpired(
  offer: CandidateOfferInput,
  _policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  _inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyCheckResult {
  const expiryTime = new Date(offer.expires_at).getTime();
  const currentTime = now.getTime();

  if (isNaN(expiryTime)) {
    return {
      pass: false,
      reason: `Invalid offer expiration format: ${offer.expires_at}.`,
      checked_rule: RULE_NAMES.OFFER_NOT_EXPIRED,
    };
  }

  if (expiryTime <= currentTime) {
    return {
      pass: false,
      reason: `Offer expired at ${offer.expires_at} (current time: ${now.toISOString()}).`,
      checked_rule: RULE_NAMES.OFFER_NOT_EXPIRED,
    };
  }

  return {
    pass: true,
    reason: `Offer is currently active and unexpired (expires at ${offer.expires_at}).`,
    checked_rule: RULE_NAMES.OFFER_NOT_EXPIRED,
  };
}

/**
 * 6. Payment Amount Exactness Check:
 * payment.amount == contract.final_price_paise * offer.quantity (exact, integer, zero tolerance)
 */
export function checkPaymentAmountExact(
  offer: CandidateOfferInput,
  _policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  _inventory: InventorySnapshot,
  _now: Date = new Date()
): PolicyCheckResult {
  const expectedTotalPaise = offer.final_price_paise * offer.quantity;

  if (offer.payment_amount_paise === undefined) {
    return {
      pass: true,
      reason: 'No payment amount provided for pre-payment check.',
      checked_rule: RULE_NAMES.PAYMENT_AMOUNT_EXACT,
    };
  }

  if (offer.payment_amount_paise !== expectedTotalPaise) {
    return {
      pass: false,
      reason: `Payment amount mismatch: Expected exactly ${expectedTotalPaise} paise, but received ${offer.payment_amount_paise} paise (zero tolerance).`,
      checked_rule: RULE_NAMES.PAYMENT_AMOUNT_EXACT,
    };
  }

  return {
    pass: true,
    reason: `Payment amount exactly matches contracted amount of ${expectedTotalPaise} paise.`,
    checked_rule: RULE_NAMES.PAYMENT_AMOUNT_EXACT,
  };
}

/**
 * 7. Human Approval Threshold Check:
 * order_total_paise <= human_approval_threshold_paise, else route to APPROVAL_PENDING
 */
export function checkHumanApprovalThreshold(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  _inventory: InventorySnapshot,
  _now: Date = new Date()
): PolicyCheckResult {
  const orderTotalPaise = offer.final_price_paise * offer.quantity;

  if (orderTotalPaise > policy.human_approval_above_paise) {
    return {
      pass: false, // Indicates human approval required
      reason: `Order total (${orderTotalPaise} paise, ₹${(orderTotalPaise / 100).toLocaleString()}) exceeds human approval threshold of ${policy.human_approval_above_paise} paise (₹${(policy.human_approval_above_paise / 100).toLocaleString()}). Routing to APPROVAL_PENDING.`,
      checked_rule: RULE_NAMES.HUMAN_APPROVAL_THRESHOLD,
    };
  }

  return {
    pass: true,
    reason: `Order total (${orderTotalPaise} paise) is within autonomous approval limit of ${policy.human_approval_above_paise} paise.`,
    checked_rule: RULE_NAMES.HUMAN_APPROVAL_THRESHOLD,
  };
}

/**
 * 8. Fast-Moving Discount Restriction Check:
 * Fast-moving products may not be discounted unless clearance flag or <= 30-day expiry applies.
 */
export function checkFastMovingDiscountRestriction(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  product: ProductSnapshot,
  inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyCheckResult {
  if (!policy.no_discount_fast_moving) {
    return {
      pass: true,
      reason: 'No-discount-fast-moving policy is not enabled.',
      checked_rule: RULE_NAMES.FAST_MOVING_DISCOUNT_RESTRICTION,
    };
  }

  if (product.movement_rate !== 'fast') {
    return {
      pass: true,
      reason: `Product movement rate is '${product.movement_rate}', standard discounting permitted.`,
      checked_rule: RULE_NAMES.FAST_MOVING_DISCOUNT_RESTRICTION,
    };
  }

  if (offer.discount_paise <= 0) {
    return {
      pass: true,
      reason: 'No discount applied to fast-moving product.',
      checked_rule: RULE_NAMES.FAST_MOVING_DISCOUNT_RESTRICTION,
    };
  }

  // Check clearance exemption or expiring stock exemption
  const clearance = checkClearanceEligibility(offer, policy, product, inventory, now);
  if (clearance.pass) {
    return {
      pass: true,
      reason: `Fast-moving item discount allowed under clearance exemption: ${clearance.reason}`,
      checked_rule: RULE_NAMES.FAST_MOVING_DISCOUNT_RESTRICTION,
    };
  }

  return {
    pass: false,
    reason: `Discounting fast-moving SKU "${product.sku}" is prohibited by merchant policy without active clearance or upcoming expiry.`,
    checked_rule: RULE_NAMES.FAST_MOVING_DISCOUNT_RESTRICTION,
  };
}

/**
 * 9. Clearance Eligibility Check:
 * sku.clearance_flag => allow discount
 * sku.expires_within_30d => force clearance-eligible regardless of movement rate
 */
export function checkClearanceEligibility(
  _offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  product: ProductSnapshot,
  _inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyCheckResult {
  if (product.clearance_flag) {
    return {
      pass: true,
      reason: `Product SKU "${product.sku}" has clearance_flag explicitly enabled.`,
      checked_rule: RULE_NAMES.CLEARANCE_ELIGIBILITY,
    };
  }

  if (product.expiry_date) {
    const expiryTime = new Date(product.expiry_date).getTime();
    const clearWindowMs = policy.clear_within_days * 24 * 60 * 60 * 1000;

    if (!isNaN(expiryTime) && expiryTime - now.getTime() <= clearWindowMs && expiryTime >= now.getTime()) {
      return {
        pass: true,
        reason: `Product SKU "${product.sku}" expires within ${policy.clear_within_days} days (${product.expiry_date}), forcing clearance eligibility.`,
        checked_rule: RULE_NAMES.CLEARANCE_ELIGIBILITY,
      };
    }
  }

  return {
    pass: false,
    reason: `Product SKU "${product.sku}" is not clearance eligible.`,
    checked_rule: RULE_NAMES.CLEARANCE_ELIGIBILITY,
  };
}

/**
 * 10. Prepaid Incentive Allowed Check:
 * cod_return_risk == high AND payment_preference includes prepaid
 * => allow prepaid-incentive discount from promo budget, not margin
 */
export function checkPrepaidIncentiveAllowed(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  _product: ProductSnapshot,
  _inventory: InventorySnapshot,
  _now: Date = new Date()
): PolicyCheckResult {
  if (!policy.prepaid_discount_on_high_cod_risk) {
    return {
      pass: false,
      reason: 'Prepaid discount on high COD risk policy is disabled.',
      checked_rule: RULE_NAMES.PREPAID_INCENTIVE,
    };
  }

  if (offer.cod_return_risk !== 'high') {
    return {
      pass: false,
      reason: `COD return risk is '${offer.cod_return_risk || 'normal'}', prepaid risk subsidy not applicable.`,
      checked_rule: RULE_NAMES.PREPAID_INCENTIVE,
    };
  }

  const prepaidMethods = ['upi', 'card', 'netbanking'];
  const hasPrepaid = offer.payment_methods_allowed.some((m) => prepaidMethods.includes(m.toLowerCase()));

  if (!hasPrepaid) {
    return {
      pass: false,
      reason: 'High COD risk present, but no prepaid payment method was selected.',
      checked_rule: RULE_NAMES.PREPAID_INCENTIVE,
    };
  }

  return {
    pass: true,
    reason: 'Prepaid incentive discount allowed from promotional budget due to high COD return risk.',
    checked_rule: RULE_NAMES.PREPAID_INCENTIVE,
  };
}

/**
 * Composite Policy Evaluator:
 * Executes all rules and produces comprehensive evaluation with state determination.
 */
export function evaluateAllPolicies(
  offer: CandidateOfferInput,
  policy: MerchantPolicyConfig,
  product: ProductSnapshot,
  inventory: InventorySnapshot,
  now: Date = new Date()
): PolicyEvaluationResult {
  const checks: PolicyCheckResult[] = [];
  const rejection_reasons: string[] = [];

  // 1. Min margin check (Hard Constraint)
  const marginCheck = checkMinMargin(offer, policy, product, inventory, now);
  checks.push(marginCheck);
  if (!marginCheck.pass) rejection_reasons.push(marginCheck.reason);

  // 2. Max discount check (Hard Constraint)
  const discountCheck = checkMaxDiscount(offer, policy, product, inventory, now);
  checks.push(discountCheck);
  if (!discountCheck.pass) rejection_reasons.push(discountCheck.reason);

  // 3. Inventory availability (Hard Constraint)
  const invCheck = checkInventoryAvailability(offer, policy, product, inventory, now);
  checks.push(invCheck);
  if (!invCheck.pass) rejection_reasons.push(invCheck.reason);

  // 4. Delivery promise reachability (Hard Constraint)
  const deliveryCheck = checkDeliveryReachable(offer, policy, product, inventory, now);
  checks.push(deliveryCheck);
  if (!deliveryCheck.pass) rejection_reasons.push(deliveryCheck.reason);

  // 5. Expiry check (Hard Constraint)
  const expiryCheck = checkOfferNotExpired(offer, policy, product, inventory, now);
  checks.push(expiryCheck);
  if (!expiryCheck.pass) rejection_reasons.push(expiryCheck.reason);

  // 6. Payment exactness (Hard Constraint if payment provided)
  const paymentCheck = checkPaymentAmountExact(offer, policy, product, inventory, now);
  checks.push(paymentCheck);
  if (!paymentCheck.pass) rejection_reasons.push(paymentCheck.reason);

  // 7. Fast moving discount restriction (Hard Constraint)
  const fastMovingCheck = checkFastMovingDiscountRestriction(offer, policy, product, inventory, now);
  checks.push(fastMovingCheck);
  if (!fastMovingCheck.pass) rejection_reasons.push(fastMovingCheck.reason);

  // 8. Human approval threshold check (Routing Constraint)
  const approvalCheck = checkHumanApprovalThreshold(offer, policy, product, inventory, now);
  checks.push(approvalCheck);

  const requires_human_approval = !approvalCheck.pass;

  if (rejection_reasons.length > 0) {
    return {
      pass: false,
      status: 'POLICY_REJECTED',
      checks,
      rejection_reasons,
      requires_human_approval,
      policy_version: policy.policy_version,
    };
  }

  if (requires_human_approval) {
    return {
      pass: true,
      status: 'APPROVAL_PENDING',
      checks,
      rejection_reasons: [],
      requires_human_approval: true,
      policy_version: policy.policy_version,
    };
  }

  return {
    pass: true,
    status: 'POLICY_APPROVED',
    checks,
    rejection_reasons: [],
    requires_human_approval: false,
    policy_version: policy.policy_version,
  };
}

export function placeholderPolicyCheck(): PolicyCheckResult {
  return {
    pass: true,
    reason: 'Policy engine scaffold ready',
    checked_rule: 'SCAFFOLD_CHECK',
  };
}
