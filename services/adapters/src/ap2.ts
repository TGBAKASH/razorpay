import {
  type CommonCommerceObject,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from './common-commerce-object.js';

/**
 * =========================================================================
 * NOTE ON REAL-WORLD AP2 (AGENT PAYMENT PROTOCOL v2) SCOPE:
 * =========================================================================
 * The full specification for the Agent Payment Protocol v2 (AP2) mandates:
 * 1. Cryptographic client mandate signature verification (e.g. ISO 20022 / W3C Verifiable Credentials).
 * 2. Multi-signature bank gateway token exchange and zero-trust pre-authorization locks.
 * 3. Recurring automated debit mandates under national regulatory frameworks (e.g. RBI e-Mandate).
 *
 * In this DealFlow implementation, the cryptographic mandate verification is
 * INTENTIONALLY STUBBED. The authorization mandate constraints are extracted and
 * mapped directly into the Common Commerce Object (CCO), with payments verified
 * and settled against Razorpay test mode.
 * =========================================================================
 */

export interface Ap2Payload {
  ap2_header: {
    protocol: 'AP2/2.0' | string;
    source_agent_id: string;
    session_token?: string;
  };
  authorization_mandate: {
    mandate_id: string;
    max_amount_paise: number;
    currency: 'INR' | string;
    valid_until_utc: string; // ISO8601
    mandate_signature?: string; // Stubbed cryptographic signature
  };
  cart_request: {
    category: string;
    quantity: number;
    payment_methods_accepted: string[];
    return_window_min_days?: number;
    priority_order?: string[];
    query_description?: string;
  };
}

/**
 * Maps raw AP2 (Agent Payment Protocol v2) payload into canonical Common Commerce Object (CCO).
 */
export function adaptAp2ToCCO(payload: Ap2Payload): CommonCommerceObject {
  const mandate = payload.authorization_mandate;
  const cartReq = payload.cart_request;

  const railsMap: Record<string, PaymentPreferenceMethod> = {
    upi: 'upi',
    card: 'card',
    netbanking: 'netbanking',
    cod: 'cod',
  };

  const paymentPreferences: PaymentPreferenceMethod[] = (cartReq.payment_methods_accepted || ['upi'])
    .map((r) => railsMap[r.toLowerCase()] || 'upi')
    .filter(Boolean);

  const priorities: PriorityFactor[] = (cartReq.priority_order || ['price', 'delivery_speed', 'return_terms', 'extras']).map((p) => {
    const lower = p.toLowerCase();
    if (lower.includes('speed') || lower.includes('delivery')) return 'delivery_speed';
    if (lower.includes('return')) return 'return_terms';
    if (lower.includes('extra') || lower.includes('custom') || lower.includes('brand')) return 'extras';
    return 'price';
  });

  return {
    intent: {
      id: `ap2-intent-${Math.random().toString(36).substring(2, 9)}`,
      buyer_agent_id: payload.ap2_header.source_agent_id || 'ap2-agent-01',
      protocol_source: 'AP2',
      category: cartReq.category,
      raw_query: cartReq.query_description || `AP2 Mandate: ${mandate.mandate_id}`,
      created_at: new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: mandate.max_amount_paise,
      currency: 'INR',
      delivery_deadline: mandate.valid_until_utc,
      quantity: cartReq.quantity || 1,
      payment_preference: paymentPreferences.length > 0 ? paymentPreferences : ['upi'],
      return_preference: `${cartReq.return_window_min_days || 10}-day returns`,
      priorities: priorities.length > 0 ? priorities : ['price', 'delivery_speed', 'return_terms', 'extras'],
    },
    cart: { items: [] },
    offer: null,
    authorization: {
      signature: mandate.mandate_signature || 'stub_ap2_mandate_sig_99fa',
      signing_key_id: 'ap2-client-key-v1',
      nonce: mandate.mandate_id,
      signed_at: new Date().toISOString(),
    },
    payment: null,
    fulfillment: {
      state: 'REQUEST_RECEIVED',
      events: [],
    },
  };
}

/**
 * Sample Mock AP2 Payload for Testing
 */
export const sampleAp2Payload: Ap2Payload = {
  ap2_header: {
    protocol: 'AP2/2.0',
    source_agent_id: 'ap2-buyer-enterprise-01',
    session_token: 'tok_ap2_live_session_88a',
  },
  authorization_mandate: {
    mandate_id: 'mandate_ap2_corp_441',
    max_amount_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    valid_until_utc: '2026-09-01T23:59:59Z',
    mandate_signature: 'ap2_sig_hmac256_mock_0192837465',
  },
  cart_request: {
    category: 'running shoes',
    quantity: 1,
    payment_methods_accepted: ['UPI', 'CARD'],
    return_window_min_days: 10,
    priority_order: ['delivery_speed', 'price', 'return_terms', 'extras'],
    query_description: 'AP2 mandate for SprintPro X2 under ₹4,000 budget',
  },
};
