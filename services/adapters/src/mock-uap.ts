import {
  type CommonCommerceObject,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from './common-commerce-object.js';

/**
 * =========================================================================
 * NOTE ON MOCK-UAP (UNIVERSAL AGENT PROTOCOL) SCOPE:
 * =========================================================================
 * The Universal Agent Protocol (UAP) provides a lightweight JSON-RPC envelope
 * format for autonomous agent query-negotiation loops.
 *
 * In this implementation, the envelope is parsed directly into the Common
 * Commerce Object (CCO), normalizing constraints and priorities for Phase 3-5
 * evaluation.
 * =========================================================================
 */

export interface MockUapPayload {
  uap_version: string;
  envelope: {
    agent_uri: string;
    action: 'query' | 'negotiate' | 'rfp';
    category_query: string;
    max_budget_paise: number;
    target_delivery_iso: string;
    qty: number;
    payment_methods: string[];
    priority_factors?: string[];
  };
}

/**
 * Maps raw Mock-UAP payload into canonical Common Commerce Object (CCO).
 */
export function adaptMockUapToCCO(payload: MockUapPayload): CommonCommerceObject {
  const env = payload.envelope;

  const railsMap: Record<string, PaymentPreferenceMethod> = {
    upi: 'upi',
    card: 'card',
    netbanking: 'netbanking',
    cod: 'cod',
  };

  const paymentPreferences: PaymentPreferenceMethod[] = (env.payment_methods || ['upi'])
    .map((r) => railsMap[r.toLowerCase()] || 'upi')
    .filter(Boolean);

  const priorities: PriorityFactor[] = (env.priority_factors || ['price', 'delivery_speed', 'return_terms', 'extras']).map((p) => {
    const lower = p.toLowerCase();
    if (lower.includes('speed') || lower.includes('delivery')) return 'delivery_speed';
    if (lower.includes('return')) return 'return_terms';
    if (lower.includes('extra') || lower.includes('custom') || lower.includes('brand')) return 'extras';
    return 'price';
  });

  return {
    intent: {
      id: `uap-intent-${Math.random().toString(36).substring(2, 9)}`,
      buyer_agent_id: env.agent_uri || 'agent://uap/default',
      protocol_source: 'mock-UAP',
      category: env.category_query,
      raw_query: `UAP action: ${env.action}`,
      created_at: new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: env.max_budget_paise,
      currency: 'INR',
      delivery_deadline: env.target_delivery_iso,
      quantity: env.qty || 1,
      payment_preference: paymentPreferences.length > 0 ? paymentPreferences : ['upi'],
      return_preference: 'standard 7-day returns',
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
 * Sample Mock UAP Payload for Testing
 */
export const sampleMockUapPayload: MockUapPayload = {
  uap_version: '1.0',
  envelope: {
    agent_uri: 'agent://uap.mesh/runner-42',
    action: 'negotiate',
    category_query: 'running shoes',
    max_budget_paise: 400000,
    target_delivery_iso: '2026-09-01T23:59:59Z',
    qty: 1,
    payment_methods: ['UPI'],
    priority_factors: ['price', 'delivery_speed', 'return_terms', 'extras'],
  },
};
