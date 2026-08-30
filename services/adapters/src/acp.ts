import {
  type CommonCommerceObject,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from './common-commerce-object.js';

/**
 * =========================================================================
 * NOTE ON REAL-WORLD ACP (AGENT COMMERCE PROTOCOL) SCOPE:
 * =========================================================================
 * A full production implementation of the Agent Commerce Protocol (ACP) includes:
 * 1. Multi-party cryptographic escrow smart contracts on decentralized ledgers.
 * 2. On-chain agent reputation registry lookup and peer trust scoring.
 * 3. Challenge-response mediation dispute arbitration tokens and zero-knowledge receipts.
 *
 * In this DealFlow implementation, these components are INTENTIONALLY STUBBED
 * to focus strictly on deterministic commerce normalization, signed contract
 * negotiation, and Razorpay test mode settlement. This is an explicit architectural
 * scope boundary, not an accidental gap.
 * =========================================================================
 */

export interface AcpPayload {
  header: {
    protocol_version: 'ACP/1.0' | string;
    agent_id: string;
    agent_public_key?: string;
    timestamp: string;
  };
  transaction: {
    item_category: string;
    max_spend_paise: number;
    currency?: 'INR' | string;
    order_quantity: number;
    required_by_utc: string; // ISO8601
    payment_rails: string[]; // e.g. ['UPI', 'CARD']
    return_policy_min_days?: number;
    negotiation_priorities: string[]; // e.g. ['price', 'delivery_speed', 'return_terms', 'extras']
    notes?: string;
  };
}

/**
 * Maps raw ACP (Agent Commerce Protocol) payload into canonical Common Commerce Object (CCO).
 */
export function adaptAcpToCCO(payload: AcpPayload): CommonCommerceObject {
  const railsMap: Record<string, PaymentPreferenceMethod> = {
    upi: 'upi',
    card: 'card',
    netbanking: 'netbanking',
    cod: 'cod',
  };

  const paymentPreferences: PaymentPreferenceMethod[] = payload.transaction.payment_rails
    .map((r) => railsMap[r.toLowerCase()] || 'upi')
    .filter(Boolean);

  const priorities: PriorityFactor[] = payload.transaction.negotiation_priorities.map((p) => {
    const lower = p.toLowerCase();
    if (lower.includes('speed') || lower.includes('delivery')) return 'delivery_speed';
    if (lower.includes('return')) return 'return_terms';
    if (lower.includes('extra') || lower.includes('custom') || lower.includes('brand')) return 'extras';
    return 'price';
  });

  return {
    intent: {
      id: `acp-intent-${Math.random().toString(36).substring(2, 9)}`,
      buyer_agent_id: payload.header.agent_id || 'acp-agent-default',
      protocol_source: 'ACP',
      category: payload.transaction.item_category,
      raw_query: payload.transaction.notes || null,
      created_at: payload.header.timestamp || new Date().toISOString(),
    },
    buyer_constraints: {
      budget_max_paise: payload.transaction.max_spend_paise,
      currency: 'INR',
      delivery_deadline: payload.transaction.required_by_utc,
      quantity: payload.transaction.order_quantity || 1,
      payment_preference: paymentPreferences.length > 0 ? paymentPreferences : ['upi'],
      return_preference: `${payload.transaction.return_policy_min_days || 7}-day returns`,
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
 * Sample Mock ACP Payloads for Testing
 */
export const sampleAcpSprintProPayload: AcpPayload = {
  header: {
    protocol_version: 'ACP/1.0',
    agent_id: 'acp-agent-runner-01',
    agent_public_key: 'ed25519_pk_8f7b3c2e1a9d8f7b3c2e1a9d8f7b3c2e',
    timestamp: '2026-08-25T12:00:00Z',
  },
  transaction: {
    item_category: 'running shoes',
    max_spend_paise: 400000, // ₹4,000 max budget
    currency: 'INR',
    order_quantity: 1,
    required_by_utc: '2026-09-01T23:59:59Z', // Tuesday deadline
    payment_rails: ['UPI', 'CARD'],
    return_policy_min_days: 7,
    negotiation_priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
    notes: 'Looking for fast responsive road running shoes under ₹4,000',
  },
};

export const sampleAcpGiftBoxPayload: AcpPayload = {
  header: {
    protocol_version: 'ACP/1.0',
    agent_id: 'acp-enterprise-buyer-99',
    timestamp: '2026-08-25T12:00:00Z',
  },
  transaction: {
    item_category: 'Corporate Gift Boxes',
    max_spend_paise: 3000000, // ₹30,000 unit budget
    currency: 'INR',
    order_quantity: 20,
    required_by_utc: '2026-09-04T23:59:59Z',
    payment_rails: ['UPI'],
    return_policy_min_days: 10,
    negotiation_priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
    notes: '20 executive hampers for Bengaluru office kickoff',
  },
};
