import {
  type CommonCommerceObject,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from './common-commerce-object.js';

/**
 * =========================================================================
 * NOTE ON REAL-WORLD UCP (UNIVERSAL COMMERCE PROTOCOL) SCOPE:
 * =========================================================================
 * The full specification for the Universal Commerce Protocol (UCP) encompasses:
 * 1. Federated cross-border identity assertion & Decentralized Identifiers (DIDs).
 * 2. Distributed Hash Table (DHT) catalog query routing and federated merchant discovery.
 * 3. Zero-knowledge location verification and compliance proofs across jurisdictions.
 *
 * In this DealFlow implementation, these components are INTENTIONALLY STUBBED
 * to provide a clear, lightweight mapper into the Common Commerce Object (CCO)
 * and demonstrate protocol interoperability.
 * =========================================================================
 */

export interface UcpPayload {
  ucp_version: '2.4' | string;
  session_id?: string;
  buyer_context: {
    buyer_did: string; // e.g. "did:ucp:agent:98a72b"
    category_target: string;
    budget_limit_paise?: number;
    budget_limit_inr?: number; // supports INR conversion
    units_requested: number;
    delivery_sla_utc: string; // ISO8601
    payment_preferences: string[];
    return_preference_str?: string;
    priority_ranking?: string[];
  };
}

/**
 * Maps raw UCP (Universal Commerce Protocol) payload into canonical Common Commerce Object (CCO).
 */
export function adaptUcpToCCO(payload: UcpPayload): CommonCommerceObject {
  const ctx = payload.buyer_context;

  const budgetPaise = ctx.budget_limit_paise !== undefined
    ? ctx.budget_limit_paise
    : ctx.budget_limit_inr !== undefined
    ? Math.round(ctx.budget_limit_inr * 100)
    : 400000;

  const railsMap: Record<string, PaymentPreferenceMethod> = {
    upi: 'upi',
    card: 'card',
    netbanking: 'netbanking',
    cod: 'cod',
  };

  const paymentPreferences: PaymentPreferenceMethod[] = (ctx.payment_preferences || ['upi'])
    .map((r) => railsMap[r.toLowerCase()] || 'upi')
    .filter(Boolean);

  const priorities: PriorityFactor[] = (ctx.priority_ranking || ['price', 'delivery_speed', 'return_terms', 'extras']).map((p) => {
    const lower = p.toLowerCase();
    if (lower.includes('speed') || lower.includes('delivery')) return 'delivery_speed';
    if (lower.includes('return')) return 'return_terms';
    if (lower.includes('extra') || lower.includes('custom') || lower.includes('brand')) return 'extras';
    return 'price';
  });

  return {
    intent: {
      id: `ucp-intent-${Math.random().toString(36).substring(2, 9)}`,
      buyer_agent_id: ctx.buyer_did || 'did:ucp:default_buyer',
      protocol_source: 'UCP',
      category: ctx.category_target,
      raw_query: `UCP v${payload.ucp_version} Session: ${payload.session_id || 'direct'}`,
      created_at: new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: budgetPaise,
      currency: 'INR',
      delivery_deadline: ctx.delivery_sla_utc,
      quantity: ctx.units_requested || 1,
      payment_preference: paymentPreferences.length > 0 ? paymentPreferences : ['upi'],
      return_preference: ctx.return_preference_str || 'flexible 7-day returns',
      priorities: priorities.length > 0 ? priorities : ['price', 'delivery_speed', 'return_terms', 'extras'],
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
}

/**
 * Sample Mock UCP Payload for Testing
 */
export const sampleUcpPayload: UcpPayload = {
  ucp_version: '2.4',
  session_id: 'ucp_sess_982f1b4a',
  buyer_context: {
    buyer_did: 'did:ucp:agent:bangalore_runner_42',
    category_target: 'running shoes',
    budget_limit_paise: 400000,
    units_requested: 1,
    delivery_sla_utc: '2026-09-01T23:59:59Z',
    payment_preferences: ['UPI'],
    return_preference_str: 'easy returns',
    priority_ranking: ['price', 'delivery_speed', 'return_terms', 'extras'],
  },
};
