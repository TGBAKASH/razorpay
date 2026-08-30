import {
  type CommonCommerceObject,
  CommonCommerceObjectSchema,
  type PaymentPreferenceMethod,
} from './common-commerce-object.js';

export interface X402Payload {
  resource_uri?: string;
  sku?: string;
  category?: string;
  quantity?: number;
  max_amount_paise?: number;
  currency?: string;
  buyer_id?: string;
  valid_until?: string;
  payment_preference?: string[];
  return_preference?: string;
}

/**
 * Lightweight Request-Shape Mapper for HTTP x402 Payment Required Protocol
 * Maps x402 negotiation metadata directly into the canonical Common Commerce Object (CCO).
 * Note: Pure request shape mapper; zero on-chain/crypto dependencies.
 */
export function adaptX402ToCCO(payload: X402Payload): CommonCommerceObject {
  const quantity = payload.quantity ?? 1;
  const budgetMaxPaise =
    typeof payload.max_amount_paise === 'number'
      ? payload.max_amount_paise
      : 400000;

  const validUntil =
    payload.valid_until ||
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const candidateSku = payload.sku || (payload.resource_uri?.includes('sprintpro') ? 'SPRINTPRO-X2' : 'SPRINTPRO-X2');

  const paymentPreference: PaymentPreferenceMethod[] = (
    payload.payment_preference && payload.payment_preference.length > 0
      ? payload.payment_preference.map((p) => p.toLowerCase() as PaymentPreferenceMethod)
      : ['upi', 'card']
  );

  const ccoRaw: CommonCommerceObject = {
    intent: {
      id: `x402-intent-${Math.random().toString(36).substring(2, 9)}`,
      buyer_agent_id: payload.buyer_id || 'buyer-agent-x402-01',
      protocol_source: 'x402',
      category: payload.category || 'Footwear / Running Shoes',
      raw_query: `x402 resource request: ${payload.resource_uri || candidateSku}`,
      created_at: new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: budgetMaxPaise,
      currency: 'INR',
      delivery_deadline: validUntil,
      quantity,
      payment_preference: paymentPreference,
      return_preference: payload.return_preference || 'easy returns',
      priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
    },
    cart: { items: [] },
    offer: null,
    authorization: null,
    payment: null,
    fulfillment: {
      state: 'REQUEST_RECEIVED',
      events: [],
    },
  };

  return CommonCommerceObjectSchema.parse(ccoRaw);
}
