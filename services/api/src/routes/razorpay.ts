import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

// 1:1 Stored Orders Index (indexed by razorpay_order_id and offer_id)
export const orderStore = new Map<string, StoredOrderRecord>();
export const offerToOrderMap = new Map<string, string>(); // offer_id -> razorpay_order_id

// Idempotent Processed Webhook Events Store
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

    // Check if offer_id is already bound to an order (1:1 constraint)
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

      // Verify returned amount matches contract (Zero-Tolerance Invariant 2)
      if (razorpayOrder.amount !== expectedAmountPaise) {
        throw new Error(`Razorpay order amount (${razorpayOrder.amount}) does not match contract amount (${expectedAmountPaise}).`);
      }

      // If state is POLICY_APPROVED, auto-advance to OFFER_ACCEPTED
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

      // State Transition: OFFER_ACCEPTED -> ORDER_CREATED
      stateMachine.transition(offerId, 'ORDER_CREATED', {
        action: 'RAZORPAY_ORDER_CREATED_FROM_CONTRACT',
        actor: 'system:razorpay_client',
        input_data: {
          offer_id: offerId,
          sku: payload.sku,
          quantity: payload.quantity,
          amount_paise: expectedAmountPaise,
        },
        policy_version: payload.policy_version,
        policy_checked: 'RULE_ORDER_AMOUNT_EXACT_MATCH',
        reason: `Created Razorpay order (${razorpayOrder.id}) for exact contract amount of ${expectedAmountPaise} paise (₹${(expectedAmountPaise / 100).toLocaleString()}).`,
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
        amount_paise: expectedAmountPaise,
        currency: 'INR',
        status: 'created',
        contract: signedContract,
        receipt: razorpayOrder.receipt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store 1:1 bindings
      orderStore.set(razorpayOrder.id, storedRecord);
      offerToOrderMap.set(payload.offer_id, razorpayOrder.id);

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

  // 2. Idempotent Razorpay Webhook Handler
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

    // Step 1: Cryptographic signature verification using exact raw request body
    const isValidSignature = defaultRazorpayClient.verifyWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook signature' });
    }

    const payload = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as any;
    const eventType = payload.event;
    const eventId = payload.event_id || payload.id || `evt_${payload.payload?.payment?.entity?.id || 'unknown'}_${eventType}`;

    // Step 2: Idempotency Check - Short-circuit on duplicate event ID
    if (processedWebhookEvents.has(eventId)) {
      return reply.status(200).send({
        status: 'ignored_duplicate',
        event_id: eventId,
        message: 'Webhook event already processed (idempotent ignore).',
      });
    }

    // Step 3: Handle Payment Events
    if (eventType === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return reply.status(400).send({ success: false, error: 'Missing payment entity in payload' });
      }

      const razorpayOrderId = paymentEntity.order_id;
      const paymentAmountPaise = paymentEntity.amount;
      const paymentId = paymentEntity.id;

      const storedOrder = orderStore.get(razorpayOrderId);
      if (!storedOrder) {
        return reply.status(404).send({ success: false, error: 'Order not found for payment' });
      }

      const offerId = storedOrder.offer_id;

      // State Transition: ORDER_CREATED -> PAYMENT_ATTEMPTED
      const current = stateMachine.getCurrentState(offerId);
      if (current === 'ORDER_CREATED') {
        stateMachine.transition(offerId, 'PAYMENT_ATTEMPTED', {
          action: 'PAYMENT_GATEWAY_INTERACTION_STARTED',
          actor: `buyer_agent:${storedOrder.contract.buyer_agent_id}`,
          input_data: { payment_id: paymentId, method: paymentEntity.method },
          policy_version: storedOrder.contract.canonical_payload.policy_version,
          policy_checked: 'RULE_PAYMENT_METHOD_ALLOWED',
          reason: `Payment initiated via ${paymentEntity.method?.toUpperCase() || 'prepaid method'}.`,
          razorpay_request: { order_id: razorpayOrderId, payment_id: paymentId },
          razorpay_response: paymentEntity,
        });
      }

      // Part 3 Step 7 Security Cross-Check:
      // webhook.payload.amount == contract.final_price_paise AND webhook.payload.order_id == stored razorpay_order_id
      const expectedAmountPaise = storedOrder.contract.canonical_payload.final_price_paise * storedOrder.contract.canonical_payload.quantity;

      if (paymentAmountPaise !== expectedAmountPaise || razorpayOrderId !== storedOrder.order_id) {
        // Mismatch detected -> Transition to FLAGGED
        storedOrder.status = 'flagged';
        storedOrder.updated_at = new Date().toISOString();

        stateMachine.transition(offerId, 'FLAGGED', {
          action: 'SECURITY_ALERT_PAYMENT_AMOUNT_MISMATCH',
          actor: 'webhook:razorpay',
          input_data: {
            expected_amount_paise: expectedAmountPaise,
            received_amount_paise: paymentAmountPaise,
            order_id: razorpayOrderId,
          },
          policy_version: storedOrder.contract.canonical_payload.policy_version,
          policy_checked: 'RULE_PAYMENT_AMOUNT_EXACT',
          reason: `SECURITY ALERT: Webhook amount mismatch! Expected ${expectedAmountPaise} paise (₹${(expectedAmountPaise / 100).toLocaleString()}), but received ${paymentAmountPaise} paise (₹${(paymentAmountPaise / 100).toLocaleString()}). Order flagged for fraud investigation.`,
          razorpay_request: { expected_amount: expectedAmountPaise },
          razorpay_response: paymentEntity,
        });

        processedWebhookEvents.add(eventId);

        return reply.status(200).send({
          status: 'flagged_mismatch',
          order_id: razorpayOrderId,
          reason: 'Amount mismatch against signed contract. Order marked FLAGGED.',
        });
      }

      // Exact amount cross-check PASSED -> Transition to PAID
      storedOrder.status = 'paid';
      storedOrder.payment_id = paymentId;
      storedOrder.updated_at = new Date().toISOString();

      stateMachine.transition(offerId, 'PAID', {
        action: 'PAYMENT_CAPTURED_AND_SETTLED',
        actor: 'webhook:razorpay',
        input_data: {
          razorpay_order_id: razorpayOrderId,
          payment_id: paymentId,
          amount_paise: paymentAmountPaise,
        },
        policy_version: storedOrder.contract.canonical_payload.policy_version,
        policy_checked: 'RULE_PAYMENT_AMOUNT_EXACT',
        reason: `Payment verified and captured: Razorpay order ID ${razorpayOrderId} and amount ${paymentAmountPaise} paise exactly matched signed OfferContract.`,
        razorpay_request: { order_id: razorpayOrderId, payment_id: paymentId },
        razorpay_response: paymentEntity,
      });

      processedWebhookEvents.add(eventId);

      return reply.status(200).send({
        status: 'processed_paid',
        order_id: razorpayOrderId,
        payment_id: paymentId,
      });
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const storedOrder = razorpayOrderId ? orderStore.get(razorpayOrderId) : undefined;

      if (storedOrder) {
        storedOrder.status = 'failed';
        storedOrder.updated_at = new Date().toISOString();

        const offerId = storedOrder.offer_id;
        const current = stateMachine.getCurrentState(offerId);
        if (current === 'ORDER_CREATED') {
          stateMachine.setCurrentState(offerId, 'PAYMENT_ATTEMPTED');
        }
        stateMachine.transition(offerId, 'FAILED', {
          action: 'PAYMENT_FAILED_AT_GATEWAY',
          actor: 'webhook:razorpay',
          input_data: { error: paymentEntity?.error_description },
          policy_version: storedOrder.contract.canonical_payload.policy_version,
          policy_checked: 'RULE_PAYMENT_GATEWAY_SUCCESS',
          reason: `Payment failed: ${paymentEntity?.error_description || 'Declined by bank'}.`,
          razorpay_response: paymentEntity,
        });
      }

      processedWebhookEvents.add(eventId);

      return reply.status(200).send({
        status: 'processed_failed',
        order_id: razorpayOrderId,
      });
    }

    if (eventType === 'refund.processed') {
      const refundEntity = payload.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;

      let targetOrder: StoredOrderRecord | undefined;
      for (const order of orderStore.values()) {
        if (order.payment_id === paymentId) {
          targetOrder = order;
          break;
        }
      }

      if (targetOrder) {
        targetOrder.status = 'refunded';
        targetOrder.updated_at = new Date().toISOString();

        stateMachine.transition(targetOrder.offer_id, 'REFUNDED', {
          action: 'REFUND_PROCESSED_BY_GATEWAY',
          actor: 'webhook:razorpay',
          input_data: { refund_id: refundEntity?.id, amount_paise: refundEntity?.amount },
          policy_version: targetOrder.contract.canonical_payload.policy_version,
          policy_checked: 'RULE_REFUND_SETTLEMENT',
          reason: 'Refund successfully completed via Razorpay webhook.',
          razorpay_response: refundEntity,
        });
      }

      processedWebhookEvents.add(eventId);

      return reply.status(200).send({
        status: 'processed_refunded',
        refund_id: refundEntity?.id,
      });
    }

    processedWebhookEvents.add(eventId);
    return reply.status(200).send({ status: 'unhandled_event_acknowledged', event: eventType });
  });

  // 3. Test Refund Endpoint (for dispute / human-approval resolution path)
  fastify.post('/api/orders/:id/refund', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const orderId = params.id;
    const body = request.body as { amount_paise?: number; reason?: string };

    const storedOrder = orderStore.get(orderId);
    if (!storedOrder) {
      return reply.status(404).send({ success: false, error: `Order ${orderId} not found` });
    }

    const refundAmount = body?.amount_paise || storedOrder.amount_paise;
    const paymentId = storedOrder.payment_id || `pay_mock_${orderId}`;

    const refundResult = await defaultRazorpayClient.processRefund(paymentId, refundAmount, {
      order_id: orderId,
      reason: body?.reason || 'human_approval_dispute_resolution',
    });

    storedOrder.status = 'refunded';
    storedOrder.updated_at = new Date().toISOString();

    stateMachine.transition(storedOrder.offer_id, 'REFUNDED', {
      action: 'DISPUTE_REFUND_TRIGGERED',
      actor: 'admin:dispute_handler',
      input_data: { order_id: orderId, refund_id: refundResult.id, amount_paise: refundAmount },
      policy_version: storedOrder.contract.canonical_payload.policy_version,
      policy_checked: 'RULE_DISPUTE_RESOLUTION_REFUND',
      reason: `Refund executed: ${body?.reason || 'Dispute resolved by human merchant manager'}.`,
      razorpay_request: { payment_id: paymentId, amount: refundAmount },
      razorpay_response: refundResult,
    });

    return reply.status(200).send({
      success: true,
      refund: refundResult,
      order: storedOrder,
    });
  });

  // 4. Retrieve order status
  fastify.get('/api/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const storedOrder = orderStore.get(params.id);
    if (!storedOrder) {
      return reply.status(404).send({ success: false, error: 'Order not found' });
    }
    return reply.status(200).send({ success: true, order: storedOrder });
  });

  // 5. Retrieve full immutable audit logs (optional filter by offer_id)
  fastify.get('/api/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { offer_id?: string };
    const logs = stateMachine.getAuditTrail(query?.offer_id);
    return reply.status(200).send({ success: true, logs });
  });
}
