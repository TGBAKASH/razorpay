import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  verify,
  type SignedOfferContract,
} from '@razorpay-dealflow/contract-service';
import {
  defaultRazorpayClient,
  type RazorpayOrderResult,
} from '@razorpay-dealflow/razorpay-client';
import { activeContracts } from './offers.js';
import { stateMachine } from '../services/state-machine.js';
import { prisma } from '../db.js';

export interface StoredOrderRecord {
  order_id: string;
  offer_id: string;
  amount_paise: number;
  currency: string;
  status: 'created' | 'paid' | 'flagged' | 'failed' | 'refunded';
  contract: SignedOfferContract;
  payment_id?: string;
  receipt: string;
  created_at: string;
  updated_at: string;
}

// In-memory cache for fast lookups
export const orderStore = new Map<string, StoredOrderRecord>();
export const offerToOrderMap = new Map<string, string>(); // offer_id -> razorpay_order_id
export const processedWebhookEvents = new Set<string>();

export async function registerRazorpayRoutes(fastify: FastifyInstance) {
  // 1. Create Razorpay Order bound 1:1 to verified OfferContract
  fastify.post('/api/orders/create', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      offer_id?: string;
      signed_contract?: SignedOfferContract;
      notes?: Record<string, string>;
    };

    const signedContract = body?.signed_contract || (body?.offer_id ? activeContracts.get(body.offer_id) : undefined);

    if (!signedContract) {
      return reply.status(400).send({
        success: false,
        error: 'A verified SignedOfferContract is required to create a Razorpay order.',
      });
    }

    const payload = signedContract.canonical_payload;
    const offerId = payload.offer_id;

    // Step 1: Verify contract signature & constraints
    const verification = verify(signedContract);
    if (!verification.valid) {
      return reply.status(422).send({
        success: false,
        error: `Contract verification failed: ${verification.reason}`,
        code: 'CONTRACT_VERIFICATION_FAILED',
      });
    }

    // Step 2: Invariant 2 Check - Amount must exactly match verified contract
    const expectedAmountPaise = payload.final_price_paise * payload.quantity;

    // Check if offer_id is already bound to an order in DB or memory
    const existingOrderId = offerToOrderMap.get(payload.offer_id);
    if (existingOrderId && orderStore.has(existingOrderId)) {
      const existingOrder = orderStore.get(existingOrderId)!;
      return reply.status(200).send({
        success: true,
        order: existingOrder,
        key_id: defaultRazorpayClient.getKeyId(),
        message: 'Returning existing Razorpay order for this offer (1:1 constraint).',
      });
    }

    try {
      const razorpayOrder: RazorpayOrderResult = await defaultRazorpayClient.createOrder(
        signedContract,
        body.notes
      );

      // Verify returned amount matches contract
      if (razorpayOrder.amount !== expectedAmountPaise) {
        throw new Error(`Razorpay order amount (${razorpayOrder.amount}) does not match contract amount (${expectedAmountPaise}).`);
      }

      // Transition state to OFFER_ACCEPTED if needed
      const currentState = stateMachine.getCurrentState(offerId);
      if (currentState === 'POLICY_APPROVED') {
        stateMachine.transition(offerId, 'OFFER_ACCEPTED', {
          action: 'OFFER_ACCEPTED_FOR_ORDER_CREATION',
          actor: `buyer_agent:${payload.buyer_agent_id}`,
          input_data: { offer_id: offerId, sku: payload.sku },
          policy_version: payload.policy_version,
          policy_checked: 'RULE_SIGNATURE_VERIFIED_AND_NONCE_CONSUMED',
          reason: 'Offer accepted prior to order creation.',
        });
      }

      // Transition state: OFFER_ACCEPTED -> ORDER_CREATED
      stateMachine.transition(offerId, 'ORDER_CREATED', {
        action: 'RAZORPAY_ORDER_CREATED_EXACT_AMOUNT',
        actor: 'system:order_service',
        input_data: {
          razorpay_order_id: razorpayOrder.id,
          amount_paise: razorpayOrder.amount,
          receipt: razorpayOrder.receipt,
          notes: razorpayOrder.notes,
        },
        policy_version: payload.policy_version,
        policy_checked: 'RULE_PRICE_LOCK_INVARIANT_2',
        reason: `Razorpay order created with exact locked contract amount of ₹${(expectedAmountPaise / 100).toLocaleString()}.`,
        razorpay_request: {
          amount: expectedAmountPaise,
          currency: 'INR',
          receipt: razorpayOrder.receipt,
          notes: razorpayOrder.notes,
        },
        razorpay_response: razorpayOrder,
      });

      const storedRecord: StoredOrderRecord = {
        order_id: razorpayOrder.id,
        offer_id: payload.offer_id,
        amount_paise: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        status: 'created',
        contract: signedContract,
        receipt: razorpayOrder.receipt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      orderStore.set(razorpayOrder.id, storedRecord);
      offerToOrderMap.set(payload.offer_id, razorpayOrder.id);

      // Persist to Postgres RazorpayOrder
      if (process.env.NODE_ENV !== 'test') {
        try {
          const dbContract = await prisma.offerContract.findFirst({
            where: { offerId: payload.offer_id },
          });

          if (dbContract) {
            await prisma.razorpayOrder.upsert({
              where: { razorpayOrderId: razorpayOrder.id },
              update: {
                status: 'CREATED',
                amountPaise: razorpayOrder.amount,
              },
              create: {
                offerId: payload.offer_id,
                offerContractId: dbContract.id,
                razorpayOrderId: razorpayOrder.id,
                amountPaise: razorpayOrder.amount,
                currency: 'INR',
                status: 'CREATED',
              },
            });
          }
        } catch (dbErr) {
          console.error('Error saving order to DB:', dbErr);
        }
      }

      return reply.status(201).send({
        success: true,
        order: razorpayOrder,
        key_id: defaultRazorpayClient.getKeyId(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error creating order';
      return reply.status(500).send({
        success: false,
        error: `Failed to create Razorpay order: ${message}`,
      });
    }
  });

  // 2. Fetch Order Status (Allows UI to poll Postgres DB status)
  fastify.get('/api/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const orderId = params.id;

    // Check DB first
    const dbOrder = await prisma.razorpayOrder.findUnique({
      where: { razorpayOrderId: orderId },
      include: { offer: true, paymentEvents: true },
    });

    if (dbOrder) {
      return reply.status(200).send({
        success: true,
        order_id: dbOrder.razorpayOrderId,
        status: dbOrder.status.toLowerCase(),
        amount_paise: dbOrder.amountPaise,
        offer_id: dbOrder.offerId,
        payment_events: dbOrder.paymentEvents,
      });
    }

    const memoryOrder = orderStore.get(orderId);
    if (memoryOrder) {
      return reply.status(200).send({
        success: true,
        order_id: memoryOrder.order_id,
        status: memoryOrder.status,
        amount_paise: memoryOrder.amount_paise,
        offer_id: memoryOrder.offer_id,
      });
    }

    return reply.status(404).send({ success: false, error: 'Order not found' });
  });

  // 2b. Simulated Webhook Trigger for UI / Simulator (Signs payload with real HMAC-SHA256)
  fastify.post('/api/webhooks/simulate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      event_type?: 'payment.captured' | 'payment.tampered' | 'payment.failed';
      order_id?: string;
      offer_id?: string;
      amount_paise?: number;
    };

    const isTampered = body?.event_type === 'payment.tampered';
    const isFailed = body?.event_type === 'payment.failed';
    const orderId = body?.order_id || 'order_sprintpro001';
    const storedOrder = orderStore.get(orderId);
    const offerId = body?.offer_id || storedOrder?.offer_id || 'offer-sprintpro-checkout-001';

    const paymentAmount = isTampered ? 299900 : (body?.amount_paise || storedOrder?.amount_paise || 394900);
    const eventId = `evt_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentId = `pay_sim_${Date.now()}`;

    const webhookPayload = {
      entity: 'event',
      event: isFailed ? 'payment.failed' : 'payment.captured',
      event_id: eventId,
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: paymentAmount,
            status: isFailed ? 'failed' : 'captured',
            method: 'upi',
            notes: {
              offer_id: offerId,
            },
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const validSignature = crypto
      .createHmac('sha256', defaultRazorpayClient.getWebhookSecret())
      .update(rawBody, 'utf8')
      .digest('hex');

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'x-razorpay-signature': validSignature,
        'content-type': 'application/json',
      },
      payload: rawBody,
    });

    return reply.status(response.statusCode).send(JSON.parse(response.body));
  });

  // 3. Idempotent Razorpay Webhook Handler
  fastify.post('/api/webhooks/razorpay', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-razorpay-signature'] as string;
    const rawBody: string =
      (request as any).rawBody !== undefined
        ? (request as any).rawBody
        : typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

    if (!signature) {
      return reply.status(400).send({ success: false, error: 'Missing x-razorpay-signature header' });
    }

    // Cryptographic signature verification using raw request body
    const isValidSignature = defaultRazorpayClient.verifyWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook signature' });
    }

    const payload = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as any;
    const eventType = payload.event;
    const eventId = payload.event_id || payload.id || `evt_${payload.payload?.payment?.entity?.id || 'unknown'}_${eventType}`;

    // Idempotency Check
    if (processedWebhookEvents.has(eventId)) {
      return reply.status(200).send({
        status: 'ignored_duplicate',
        event_id: eventId,
        message: 'Webhook event already processed (idempotent ignore).',
      });
    }

    // Handle Payment Events
    if (eventType === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return reply.status(400).send({ success: false, error: 'Missing payment entity in payload' });
      }

      const razorpayOrderId = paymentEntity.order_id;
      const paymentAmountPaise = paymentEntity.amount;
      const paymentId = paymentEntity.id;

      let storedOrder = orderStore.get(razorpayOrderId);
      let dbOrder: any = null;
      if (!storedOrder && process.env.NODE_ENV !== 'test') {
        try {
          dbOrder = await prisma.razorpayOrder.findUnique({
            where: { razorpayOrderId },
            include: { contract: true },
          });
        } catch {}
      }

      const offerId = storedOrder?.offer_id || dbOrder?.offerId;
      if (!offerId) {
        return reply.status(404).send({ success: false, error: 'Order not found for payment' });
      }

      const current = stateMachine.getCurrentState(offerId);
      if (current === 'ORDER_CREATED') {
        stateMachine.transition(offerId, 'PAYMENT_ATTEMPTED', {
          action: 'PAYMENT_GATEWAY_INTERACTION_STARTED',
          actor: `buyer_agent:${storedOrder?.contract?.buyer_agent_id || 'buyer-agent'}`,
          input_data: { payment_id: paymentId, method: paymentEntity.method },
          policy_version: storedOrder?.contract?.canonical_payload?.policy_version || 'v1',
          policy_checked: 'RULE_PAYMENT_METHOD_ALLOWED',
          reason: `Payment initiated via ${paymentEntity.method?.toUpperCase() || 'prepaid method'}.`,
          razorpay_request: { order_id: razorpayOrderId, payment_id: paymentId },
          razorpay_response: paymentEntity,
        });
      }

      const expectedAmountPaise = storedOrder
        ? storedOrder.contract.canonical_payload.final_price_paise * storedOrder.contract.canonical_payload.quantity
        : dbOrder?.amountPaise || paymentAmountPaise;

      if (paymentAmountPaise !== expectedAmountPaise) {
        if (storedOrder) storedOrder.status = 'flagged';
        stateMachine.transition(offerId, 'FLAGGED', {
          action: 'SECURITY_ALERT_PAYMENT_AMOUNT_MISMATCH',
          actor: 'webhook:razorpay',
          input_data: { expected_amount_paise: expectedAmountPaise, received_amount_paise: paymentAmountPaise },
          policy_version: 'v1',
          policy_checked: 'RULE_PAYMENT_AMOUNT_EXACT',
          reason: `SECURITY ALERT: Webhook amount mismatch! Expected ${expectedAmountPaise} paise, but received ${paymentAmountPaise} paise.`,
          razorpay_response: paymentEntity,
        });

        processedWebhookEvents.add(eventId);
        return reply.status(200).send({
          status: 'flagged_mismatch',
          order_id: razorpayOrderId,
          reason: 'Amount mismatch against signed contract.',
        });
      }

      // Valid Payment
      if (storedOrder) {
        storedOrder.status = 'paid';
        storedOrder.payment_id = paymentId;
        storedOrder.updated_at = new Date().toISOString();
      }

      stateMachine.transition(offerId, 'PAID', {
        action: 'PAYMENT_CAPTURED_WEBHOOK_VERIFIED',
        actor: 'webhook:razorpay',
        input_data: { payment_id: paymentId, amount_paise: paymentAmountPaise, order_id: razorpayOrderId },
        policy_version: storedOrder?.contract?.canonical_payload?.policy_version || 'v1',
        policy_checked: 'RULE_WEBHOOK_SIGNATURE_AND_EXACT_AMOUNT',
        reason: `Payment of ₹${(paymentAmountPaise / 100).toLocaleString()} captured. Webhook HMAC verified.`,
        razorpay_response: paymentEntity,
      });

      // Update Postgres DB
      if (process.env.NODE_ENV !== 'test') {
        try {
          await prisma.razorpayOrder.updateMany({
            where: { razorpayOrderId },
            data: { status: 'PAID' },
          });

          await prisma.offer.update({
            where: { id: offerId },
            data: { status: 'PAID' },
          });

          await prisma.paymentEvent.create({
            data: {
              id: crypto.randomUUID(),
              razorpayOrderId,
              razorpayPaymentId: paymentId,
              razorpayEventId: eventId,
              eventType,
              amountPaise: paymentAmountPaise,
              currency: 'INR',
              method: paymentEntity.method,
              status: 'captured',
              rawPayload: payload as any,
            },
          });
        } catch (dbErr) {
          console.error('Error persisting payment event:', dbErr);
        }
      }

      // Update Promotion Budget in Postgres
      const finalPrice = storedOrder?.contract?.canonical_payload?.final_price_paise;
      const qty = storedOrder?.contract?.canonical_payload?.quantity || 1;
      const sku = storedOrder?.contract?.canonical_payload?.sku || 'SPRINTPRO-X2';
      const listPrice = sku === 'SPRINTPRO-X2' ? 429900 : 499900;
      const totalDiscountPaise = finalPrice ? Math.max(0, (listPrice - finalPrice) * qty) : 0;

      if (totalDiscountPaise > 0 && process.env.NODE_ENV !== 'test') {
        try {
          const merchantId = storedOrder?.contract?.canonical_payload?.merchant_id || 'merchant-sprint-alpha';
          await prisma.promotionBudget.updateMany({
            where: { merchantId },
            data: {
              spentBudgetPaise: { increment: totalDiscountPaise },
            },
          });
        } catch (budgetErr) {
          console.error('Error updating promotion budget in DB:', budgetErr);
        }
      }

      processedWebhookEvents.add(eventId);

      return reply.status(200).send({
        status: 'processed_paid',
        order_id: razorpayOrderId,
        offer_id: offerId,
        payment_id: paymentId,
        event_id: eventId,
        event_type: eventType,
        verified_at: new Date().toISOString(),
        signature_verified: true,
      });
    }

    // Handle Refund Webhook Events (refund.processed / refund.created)
    if (eventType === 'refund.processed' || eventType === 'refund.created') {
      const refundEntity = payload.payload?.refund?.entity;
      const paymentEntity = payload.payload?.payment?.entity;
      const paymentId = refundEntity?.payment_id || paymentEntity?.id;
      const refundAmountPaise = refundEntity?.amount || 0;
      const refundId = refundEntity?.id || `rfd_${Date.now()}`;

      let orderId = refundEntity?.notes?.order_id || paymentEntity?.order_id;
      let storedOrder: any = null;
      if (orderId) {
        storedOrder = orderStore.get(orderId);
      } else if (paymentId) {
        for (const ord of orderStore.values()) {
          if (ord.payment_id === paymentId) {
            storedOrder = ord;
            orderId = ord.order_id;
            break;
          }
        }
      }

      if (storedOrder) {
        storedOrder.status = 'refunded';
      }

      const offerId = storedOrder?.offer_id;
      if (offerId) {
        try {
          stateMachine.transition(offerId, 'REFUNDED', {
            action: 'WEBHOOK_REFUND_PROCESSED',
            actor: 'webhook:razorpay',
            input_data: { refund_id: refundId, payment_id: paymentId, amount_paise: refundAmountPaise },
            policy_version: storedOrder?.contract?.canonical_payload?.policy_version || 'v1',
            policy_checked: 'RULE_10_DAY_RETURN_DISPUTE_REFUND',
            reason: `Refund of ₹${(refundAmountPaise / 100).toLocaleString()} confirmed via Razorpay webhook.`,
            razorpay_response: refundEntity,
          });
        } catch {}
      }

      // Persist to Neon Postgres DB
      if (process.env.NODE_ENV !== 'test' && orderId) {
        try {
          await prisma.razorpayOrder.updateMany({
            where: { razorpayOrderId: orderId },
            data: { status: 'REFUNDED' },
          });

          if (offerId) {
            await prisma.offer.updateMany({
              where: { id: offerId },
              data: { status: 'REFUNDED' },
            });
          }

          await prisma.paymentEvent.create({
            data: {
              id: crypto.randomUUID(),
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId || 'pay_unknown',
              razorpayEventId: eventId,
              eventType,
              amountPaise: refundAmountPaise,
              currency: 'INR',
              method: paymentEntity?.method || 'upi',
              status: 'refunded',
              rawPayload: payload as any,
            },
          });
        } catch (dbErr) {
          console.error('Error persisting refund webhook event in DB:', dbErr);
        }
      }

      processedWebhookEvents.add(eventId);

      return reply.status(200).send({
        status: 'processed_refund',
        order_id: orderId,
        offer_id: offerId,
        refund_id: refundId,
        event_id: eventId,
        verified_at: new Date().toISOString(),
        signature_verified: true,
      });
    }

    processedWebhookEvents.add(eventId);
    return reply.status(200).send({ status: 'event_acknowledged', event: eventType });
  });

  // 4. Refund Endpoint
  fastify.post('/api/orders/:id/refund', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const orderId = params.id;
    const body = request.body as { reason?: string; amount_paise?: number };

    const storedOrder = orderStore.get(orderId);
    const offerId = storedOrder?.offer_id;

    if (storedOrder) {
      storedOrder.status = 'refunded';
    }

    const refundResult = await defaultRazorpayClient.processRefund(
      storedOrder?.payment_id || `pay_${orderId.substring(6)}`,
      body.amount_paise || storedOrder?.amount_paise || 394900,
      { reason: body.reason || 'Customer 10-day return dispute refund' }
    );

    if (offerId) {
      try {
        stateMachine.transition(offerId, 'REFUNDED', {
          action: 'PAYMENT_REFUND_PROCESSED',
          actor: 'merchant:dispute_handler',
          input_data: { refund_id: refundResult.id, amount_paise: refundResult.amount },
          policy_version: storedOrder?.contract.canonical_payload.policy_version || 'v1',
          policy_checked: 'RULE_10_DAY_RETURN_DISPUTE_REFUND',
          reason: `Dispute refund processed: ${body.reason || '10-day return policy terms honored'}.`,
          razorpay_response: refundResult,
        });
      } catch {}
    }

    return reply.status(200).send({
      success: true,
      refund: refundResult,
      status: 'REFUNDED',
      order: {
        id: orderId,
        status: 'refunded',
      },
    });
  });
}
