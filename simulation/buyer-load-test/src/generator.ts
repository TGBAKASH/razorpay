import {
  type BuyerConstraintsSection,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from '@razorpay-dealflow/adapters';
import {
  type ProductSnapshot,
  type MerchantPolicyConfig,
  type InventorySnapshot,
} from '@razorpay-dealflow/policy-engine';

export interface CatalogItemInfo {
  product: ProductSnapshot;
  inventory: InventorySnapshot;
  policy: MerchantPolicyConfig;
}

export interface SyntheticBuyerRequest {
  request_id: string;
  buyer_agent_id: string;
  item: CatalogItemInfo;
  buyer_constraints: BuyerConstraintsSection;
  is_gift_box: boolean;
  raw_query: string;
}

export const SIMULATION_CATALOG: CatalogItemInfo[] = [
  {
    product: {
      sku: 'SPRINTPRO-X2',
      name: 'SprintPro X2 Running Shoes',
      cost_paise: 335000, // ₹3,350
      list_price_paise: 429900, // ₹4,299
      movement_rate: 'slow',
      expiry_date: null,
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
    },
    inventory: {
      sku: 'SPRINTPRO-X2',
      available_qty: 150,
      warehouse_location: 'BLR-WH-01',
      carrier_sla_days: { 'BLR-WH-01': 2 },
    },
    policy: {
      policy_version: 'v1',
      min_margin_pct: 18.0,
      max_discount_pct: 12.0,
      free_delivery_above_paise: 149900,
      no_discount_fast_moving: true,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 1500000,
    },
  },
  {
    product: {
      sku: 'SPRINTPRO-ELITE',
      name: 'SprintPro Elite Marathoner',
      cost_paise: 520000, // ₹5,200
      list_price_paise: 699900, // ₹6,999
      movement_rate: 'fast', // fast-moving: no discounting permitted without clearance
      expiry_date: null,
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
    },
    inventory: {
      sku: 'SPRINTPRO-ELITE',
      available_qty: 85,
      warehouse_location: 'BLR-WH-01',
      carrier_sla_days: { 'BLR-WH-01': 2 },
    },
    policy: {
      policy_version: 'v1',
      min_margin_pct: 20.0,
      max_discount_pct: 10.0,
      free_delivery_above_paise: 149900,
      no_discount_fast_moving: true,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 1500000,
    },
  },
  {
    product: {
      sku: 'HYDRO-500',
      name: 'HydroFlow Stainless Sports Bottle 500ml',
      cost_paise: 75000, // ₹750
      list_price_paise: 129900, // ₹1,299
      movement_rate: 'normal',
      expiry_date: null,
      warehouse_location: 'BLR-WH-02',
      clearance_flag: false,
    },
    inventory: {
      sku: 'HYDRO-500',
      available_qty: 300,
      warehouse_location: 'BLR-WH-02',
      carrier_sla_days: { 'BLR-WH-02': 2 },
    },
    policy: {
      policy_version: 'v1',
      min_margin_pct: 25.0,
      max_discount_pct: 15.0,
      free_delivery_above_paise: 149900,
      no_discount_fast_moving: false,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 1000000,
    },
  },
  {
    product: {
      sku: 'GIFTBOX-CORP-A',
      name: 'Executive Corporate Gift Box Tier A',
      cost_paise: 2200000, // ₹22,000
      list_price_paise: 3200000, // ₹32,000
      movement_rate: 'normal',
      expiry_date: null,
      warehouse_location: 'BLR-WH-01',
      clearance_flag: false,
    },
    inventory: {
      sku: 'GIFTBOX-CORP-A',
      available_qty: 200,
      warehouse_location: 'BLR-WH-01',
      carrier_sla_days: { 'BLR-WH-01': 1 },
    },
    policy: {
      policy_version: 'v1',
      min_margin_pct: 15.0,
      max_discount_pct: 15.0,
      free_delivery_above_paise: 1000000,
      no_discount_fast_moving: false,
      clear_within_days: 30,
      prepaid_discount_on_high_cod_risk: true,
      human_approval_above_paise: 100000000,
    },
  },
];

/**
 * Deterministic pseudo-random number generator for reproducible simulation runs.
 */
class PseudoRandom {
  private seed: number;
  constructor(seed = 123456789) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

/**
 * Generates synthetic buyer requests with realistic budget/deadline/quantity distributions.
 */
export function generateSyntheticBuyerRequests(
  count = 500,
  seed = 42
): SyntheticBuyerRequest[] {
  const prng = new PseudoRandom(seed);
  const requests: SyntheticBuyerRequest[] = [];
  const now = new Date();

  const priorityPermutations: PriorityFactor[][] = [
    ['price', 'delivery_speed', 'return_terms', 'extras'],
    ['delivery_speed', 'price', 'return_terms', 'extras'],
    ['price', 'return_terms', 'delivery_speed', 'extras'],
    ['extras', 'price', 'delivery_speed', 'return_terms'],
  ];

  const paymentOptions: PaymentPreferenceMethod[][] = [
    ['upi'],
    ['card'],
    ['upi', 'card'],
    ['cod'],
    ['netbanking'],
  ];

  for (let i = 1; i <= count; i++) {
    const item = prng.choice(SIMULATION_CATALOG);
    const isGiftBox = item.product.sku.startsWith('GIFTBOX');

    // Quantity distribution
    let quantity = 1;
    if (isGiftBox) {
      quantity = Math.floor(prng.range(5, 25));
    } else {
      const qRoll = prng.next();
      if (qRoll < 0.70) quantity = 1;
      else if (qRoll < 0.90) quantity = 2;
      else quantity = Math.floor(prng.range(3, 5));
    }

    // Budget distribution:
    // 40% budget-constrained (88% - 98% of list price)
    // 40% generous budget (100% - 115% of list price)
    // 20% tight budget (< 85% of list price)
    const bRoll = prng.next();
    let budgetMultiplier = 1.0;
    if (bRoll < 0.40) {
      budgetMultiplier = prng.range(0.88, 0.98); // Sensitive to discounts
    } else if (bRoll < 0.80) {
      budgetMultiplier = prng.range(1.00, 1.15); // Normal/Generous
    } else {
      budgetMultiplier = prng.range(0.72, 0.84); // Low budget (will reject below margin floor)
    }

    const budgetMaxPaise = Math.round(item.product.list_price_paise * budgetMultiplier);

    // Delivery deadline: 3 to 7 days out
    const daysOut = Math.floor(prng.range(3, 8));
    const deadline = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000);
    deadline.setHours(23, 59, 59, 0);

    const paymentPreference = prng.choice(paymentOptions);
    const priorities = prng.choice(priorityPermutations);

    requests.push({
      request_id: `synth_req_${i.toString().padStart(4, '0')}`,
      buyer_agent_id: `buyer_sim_${i.toString().padStart(4, '0')}`,
      item,
      is_gift_box: isGiftBox,
      raw_query: `Synthetic purchase request for ${quantity}x ${item.product.name} with budget ₹${(budgetMaxPaise / 100).toLocaleString()}`,
      buyer_constraints: {
        budget_max_paise: budgetMaxPaise,
        currency: 'INR',
        delivery_deadline: deadline.toISOString(),
        quantity,
        payment_preference: paymentPreference,
        return_preference: 'flexible',
        priorities,
      },
    });
  }

  return requests;
}
