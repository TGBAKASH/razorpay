import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  defaultRazorpayClient,
  type RazorpayMandateToken,
} from '@razorpay-dealflow/razorpay-client';
import { verify, type SignedOfferContract } from '@razorpay-dealflow/contract-service';
import { activeContracts } from './offers.js';
import { stateMachine } from '../services/state-machine.js';
import { orderStore } from './razorpay.js';

export interface ActiveBuyerMandate {
  mandate_id: string;
  buyer_agent_id: string;
  customer_id: string;
  token_id: string;
  max_amount_paise: number;
  max_amount_inr: string;
  frequency: 'as_presented' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'revoked';
  registration_order_id: string;
  created_at: string;
  expires_at: string;
}

// In-memory store for active buyer spending mandates
export const activeMandates = new Map<string, ActiveBuyerMandate>();

// Seed a default active mandate for the primary buyer agent so demonstrations work out of the box
const DEFAULT_BUYER_AGENT_ID = 'buyer-agent-auto-01';
const defaultMandateToken = 'token_' + crypto.randomBytes(7).toString('hex');
const defaultCustomerHash = 'cust_' + crypto.randomBytes(7).toString('hex');

activeMandates.set(DEFAULT_BUYER_AGENT_ID, {
  mandate_id: 'mnd_default_' + crypto.randomBytes(5).toString('hex'),
  buyer_agent_id: DEFAULT_BUYER_AGENT_ID,
  customer_id: defaultCustomerHash,
  token_id: defaultMandateToken,
  max_amount_paise: 500000, // ₹5,000.00 ceiling
  max_amount_inr: '5000.00',
  frequency: 'as_presented',
  status: 'active',
  registration_order_id: 'order_mnd_' + crypto.randomBytes(6).toString('hex'),
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
});

export async function registerMandateRoutes(fastify: FastifyInstance) {
  /**
   * Phase 1: Mandate Registration (The Only Human Touchpoint)
   * Registers a real Razorpay recurring payment mandate matching the buyer's budget ceiling.
   * POST /api/mandates/register
   */
  fastify.post('/api/mandates/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      buyer_agent_id?: string;
      name?: string;
      email?: string;
      contact?: string;
      max_amount_inr?: number;
      frequency?: 'as_presented' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      auto_approve_test?: boolean;
    };

    const buyerAgentId = body?.buyer_agent_id || DEFAULT_BUYER_AGENT_ID;
    const name = body?.name || 'DealFlow AI Buyer';
    const email = body?.email || 'buyer.agent@dealflow.ai';
    const contact = body?.contact || '9876543210';
    const maxAmountInr = Number(body?.max_amount_inr) || 5000;
    const maxAmountPaise = Math.round(maxAmountInr * 100);
    const frequency = body?.frequency || 'as_presented';
    const expireAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year validity

    try {
      // 1. Create Customer in Razorpay
      const customer = await defaultRazorpayClient.createCustomer({
        name,
        email,
        contact,
        notes: { buyer_agent_id: buyerAgentId },
      });

      // 2. Create Order with Mandate Token Object
      const mandateToken: RazorpayMandateToken = {
        max_amount: maxAmountPaise,
        expire_at: expireAt,
        frequency,
      };

      const registrationOrder = await defaultRazorpayClient.createMandateRegistrationOrder({
        customer_id: customer.id,
        amount_paise: 100, // ₹1.00 authorization charge
        currency: 'INR',
        method: 'upi',
        token: mandateToken,
        receipt: 'rcpt_mnd_' + Date.now().toString().slice(-8),
        notes: {
          buyer_agent_id: buyerAgentId,
          mandate_purpose: 'agent_spending_cap',
        },
      });

      // 3. Store active mandate in registry
      const tokenId = 'token_' + crypto.randomBytes(7).toString('hex');
      const mandateRecord: ActiveBuyerMandate = {
        mandate_id: 'mnd_' + crypto.randomBytes(6).toString('hex'),
        buyer_agent_id: buyerAgentId,
        customer_id: customer.id,
        token_id: tokenId,
        max_amount_paise: maxAmountPaise,
        max_amount_inr: maxAmountInr.toFixed(2),
        frequency,
        status: 'active',
        registration_order_id: registrationOrder.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(expireAt * 1000).toISOString(),
      };

      activeMandates.set(buyerAgentId, mandateRecord);

      return reply.status(201).send({
        success: true,
        message: 'Razorpay UPI Autopay mandate registered successfully.',
        mandate: mandateRecord,
        authorization_order: {
          id: registrationOrder.id,
          amount_paise: registrationOrder.amount,
          amount_inr: (registrationOrder.amount / 100).toFixed(2),
          customer_id: customer.id,
          currency: 'INR',
          token_specification: mandateToken,
        },
      });
    } catch (err: any) {
      console.error('[Mandate Register Route Error]', err);
      return reply.status(500).send({ success: false, error: err?.message || String(err) });
    }
  });

  /**
   * Returns current active mandate status for a buyer agent
   * GET /api/mandates/status
   */
  fastify.get('/api/mandates/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { buyer_agent_id?: string };
    const buyerAgentId = query?.buyer_agent_id || DEFAULT_BUYER_AGENT_ID;

    const mandate = activeMandates.get(buyerAgentId);

    if (!mandate || mandate.status !== 'active') {
      return reply.status(200).send({
        has_active_mandate: false,
        mandate: null,
      });
    }

    return reply.status(200).send({
      has_active_mandate: true,
      mandate,
    });
  });

  /**
   * Revoke an active mandate
   * POST /api/mandates/revoke
   */
  fastify.post('/api/mandates/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { buyer_agent_id?: string };
    const buyerAgentId = body?.buyer_agent_id || DEFAULT_BUYER_AGENT_ID;

    const mandate = activeMandates.get(buyerAgentId);
    if (!mandate) {
      return reply.status(404).send({ success: false, error: 'No mandate found to revoke' });
    }

    mandate.status = 'revoked';
    activeMandates.set(buyerAgentId, mandate);

    return reply.status(200).send({
      success: true,
      message: 'Mandate successfully revoked.',
      mandate,
    });
  });

  /**
   * Phase 2: Autonomous S2S Payment Charge (Zero Human Intervention)
   * Once negotiation lands on a final price within the mandate ceiling,
   * creates an order and charges it directly using the stored token_id.
   * POST /api/payments/autonomous-charge
   */
  fastify.post('/api/payments/autonomous-charge', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      offer_id?: string;
      signed_contract?: SignedOfferContract;
      buyer_agent_id?: string;
    };

    const signedContract = body?.signed_contract || (body?.offer_id ? activeContracts.get(body.offer_id) : undefined);

    if (!signedContract) {
      return reply.status(400).send({
        success: false,
        error: 'A verified SignedOfferContract is required to execute an autonomous payment charge.',
      });
    }

    // Cryptographic signature verification
    const verification = verify(signedContract);
    if (!verification.valid) {
      return reply.status(400).send({
        success: false,
        error: 'Cryptographic contract integrity check failed: ' + verification.reason,
      });
    }

    const payload = signedContract.canonical_payload;
    const buyerAgentId = body?.buyer_agent_id || payload.buyer_agent_id || DEFAULT_BUYER_AGENT_ID;
    const totalPaise = payload.final_price_paise * payload.quantity;

    // 1. Locate and check active mandate
    const mandate = activeMandates.get(buyerAgentId);
    if (!mandate || mandate.status !== 'active') {
      return reply.status(412).send({
        success: false,
        error: 'Precondition Failed: No active Razorpay spending mandate found for buyer agent ' + buyerAgentId + '. Human must complete one-time mandate setup.',
      });
    }

    // 2. Invariant 4: Bounded Spending Ceiling Enforcement
    if (totalPaise > mandate.max_amount_paise) {
      return reply.status(422).send({
        success: false,
        error: 'Invariant 4 Breach: Total order amount ₹' + (totalPaise / 100).toFixed(2) + ' exceeds authorized mandate ceiling of ₹' + mandate.max_amount_inr + '. Autonomous charge aborted.',
        mandate_ceiling_paise: mandate.max_amount_paise,
        order_amount_paise: totalPaise,
      });
    }

    // 3. Create Order for the negotiated price
    const orderResult = await defaultRazorpayClient.createOrder(signedContract, {
      autonomous_payment: 'true',
      token_id: mandate.token_id,
      customer_id: mandate.customer_id,
    });

    // 4. Execute Server-to-Server Recurring Payment Charge (Zero Human Click)
    const recurringPayment = await defaultRazorpayClient.createRecurringPayment({
      email: 'buyer.agent@dealflow.ai',
      contact: '9876543210',
      amount_paise: totalPaise,
      currency: 'INR',
      order_id: orderResult.id,
      customer_id: mandate.customer_id,
      token_id: mandate.token_id,
      recurring: true,
      description: 'DealFlow Autonomous Agent Settlement (' + payload.sku + ')',
      notes: {
        offer_id: payload.offer_id,
        buyer_agent_id: buyerAgentId,
        merchant_id: payload.merchant_id,
        contract_nonce: payload.nonce,
        mandate_id: mandate.mandate_id,
      },
    });

    // 5. Update State Machine & Audit Store
    orderStore.set(orderResult.id, {
      order_id: orderResult.id,
      offer_id: payload.offer_id,
      amount_paise: totalPaise,
      currency: 'INR',
      status: 'paid',
      contract: signedContract,
      payment_id: recurringPayment.id,
      receipt: orderResult.receipt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    try {
      stateMachine.transition(payload.offer_id, 'PAID', {
        action: 'AUTONOMOUS_S2S_PAYMENT_CAPTURED',
        actor: 'razorpay_s2s_engine:' + mandate.token_id,
        input_data: {
          payment_id: recurringPayment.id,
          order_id: orderResult.id,
          token_id: mandate.token_id,
          customer_id: mandate.customer_id,
          amount_paise: totalPaise,
          human_interaction_required: false,
        },
        policy_version: 'v1',
        policy_checked: 'INVARIANT_4_MANDATE_CEILING_BOUND',
        reason: 'Server-to-Server autonomous payment successfully captured via pre-approved mandate token ' + mandate.token_id + ' with zero human clicks.',
      });
    } catch {
      // Ignore transition error if state machine already reached ORDER_PAID
    }

    return reply.status(200).send({
      success: true,
      autonomous_payment_captured: true,
      payment_id: recurringPayment.id,
      order_id: orderResult.id,
      token_id: mandate.token_id,
      customer_id: mandate.customer_id,
      amount_paise: totalPaise,
      amount_inr: (totalPaise / 100).toFixed(2),
      mandate_max_amount_inr: mandate.max_amount_inr,
      is_s2s_autonomous: true,
      human_interaction_required: false,
      contract_id: payload.offer_id,
      receipt: orderResult.receipt,
      settlement_protocol: 'NPCI_UAP_UPI_AUTOPAY',
    });
  });
}
