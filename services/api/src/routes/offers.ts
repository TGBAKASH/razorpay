import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  CommonCommerceObjectSchema,
  BuyerIntentSubmissionSchema,
  type CommonCommerceObject,
} from '@razorpay-dealflow/adapters';
import { processOfferNegotiation, type NegotiationResult } from '@razorpay-dealflow/offer-engine';
import {
  sign,
  verify,
  nonceStore,
  type SignedOfferContract,
} from '@razorpay-dealflow/contract-service';
import { stateMachine } from '../services/state-machine.js';
import { importCatalogFromCsv } from '../importers/catalog-csv-importer.js';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';
import { prisma } from '../db.js';
import { requireMerchantRole } from '../middleware/role-guard.js';

export const activeContracts = new Map<string, SignedOfferContract>();
export const negotiationFeed: {
  offer_id: string;
  cco: CommonCommerceObject;
  negotiation: NegotiationResult;
  created_at: string;
}[] = [];

export async function registerOfferRoutes(fastify: FastifyInstance) {
  // 1. Generate & Sign Offer Contract endpoint
  fastify.post('/api/offers/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body) {
      return reply.status(400).send({
        success: false,
        error: 'Request body is required',
      });
    }

    let cco: CommonCommerceObject;

    const directCCOParsed = CommonCommerceObjectSchema.safeParse(body.cco || body);
    if (directCCOParsed.success) {
      cco = directCCOParsed.data;
    } else {
      const submissionParsed = BuyerIntentSubmissionSchema.safeParse(body);
      if (!submissionParsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid intent payload',
          details: submissionParsed.error.errors,
        });
      }
      const data = submissionParsed.data;
      cco = {
        intent: {
          id: 'intent-' + crypto.randomUUID().substring(0, 8),
          buyer_agent_id: data.buyer_agent_id || 'buyer-agent-sim-01',
          protocol_source: data.protocol_source || 'simulator',
          category: data.category,
          raw_query: data.raw_query || null,
          created_at: new Date().toISOString(),
        },
        buyer_constraints: data.buyer_constraints,
        cart: data.cart || { items: [] },
        offer: null,
        authorization: null,
        payment: null,
        fulfillment: {
          state: 'REQUEST_RECEIVED',
          events: [],
        },
      };
    }

    const requestedSku = body.sku || cco.cart?.items?.[0]?.sku || (cco.intent.category?.toLowerCase().includes('gift') ? 'GIFTBOX-CORP-C' : 'SPRINTPRO-X2');

    let dbProduct: any = null;
    let merchant: any = null;

    if (process.env.NODE_ENV !== 'test') {
      try {
        dbProduct = await prisma.product.findFirst({
          where: {
            OR: [
              { sku: { equals: requestedSku, mode: 'insensitive' } },
              { name: { contains: requestedSku, mode: 'insensitive' } },
              { category: { contains: cco.intent.category, mode: 'insensitive' } },
            ],
          },
          include: { merchant: { include: { policies: { where: { isActive: true }, take: 1 } } } },
        });
        if (dbProduct) merchant = dbProduct.merchant;
      } catch {}
    }

    // In-memory catalog fallback
    if (!dbProduct) {
      const catMerchant = CATALOG_MERCHANTS.find((m) =>
        m.products.some((p) => p.sku.toLowerCase() === requestedSku.toLowerCase() || p.category.toLowerCase().includes(cco.intent.category.toLowerCase()))
      ) || CATALOG_MERCHANTS[0]!;

      const catProduct = catMerchant.products.find((p) => p.sku.toLowerCase() === requestedSku.toLowerCase()) || catMerchant.products[0]!;

      dbProduct = {
        id: 'prod_' + catProduct.sku,
        sku: catProduct.sku,
        name: catProduct.name,
        category: catProduct.category,
        costPaise: catProduct.costPaise,
        listPricePaise: catProduct.listPricePaise,
        inventoryQty: catProduct.inventoryQty,
        movementRate: catProduct.movementRate,
        expiryDate: catProduct.expiryDate ? new Date(catProduct.expiryDate) : null,
        warehouseLocation: catProduct.warehouseLocation,
        clearanceFlag: catProduct.clearanceFlag,
      };

      merchant = {
        id: catMerchant.id,
        name: catMerchant.name,
        slug: catMerchant.slug,
        policies: [catMerchant.policy],
      };
    }

    const activePolicy = merchant?.policies?.[0] || {
      policyVersion: 'v1',
      minMarginPct: 18.0,
      maxDiscountPct: 12.0,
      freeDeliveryAbovePaise: 149900,
      noDiscountFastMoving: true,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 1500000,
    };

    const productSnapshot = {
      sku: dbProduct.sku,
      name: dbProduct.name,
      cost_paise: dbProduct.costPaise,
      list_price_paise: dbProduct.listPricePaise,
      movement_rate: (dbProduct.movementRate || 'slow') as 'fast' | 'normal' | 'slow',
      expiry_date: dbProduct.expiryDate ? dbProduct.expiryDate.toISOString() : undefined,
      warehouse_location: dbProduct.warehouseLocation || 'BLR-WH-01',
      clearance_flag: dbProduct.clearanceFlag || false,
    };

    const policyConfig = {
      policy_version: activePolicy.policyVersion || 'v1',
      min_margin_pct: activePolicy.minMarginPct ?? 18.0,
      max_discount_pct: activePolicy.maxDiscountPct ?? 12.0,
      free_delivery_above_paise: activePolicy.freeDeliveryAbovePaise ?? 149900,
      no_discount_fast_moving: activePolicy.noDiscountFastMoving ?? true,
      clear_within_days: activePolicy.clearWithinDays ?? 30,
      prepaid_discount_on_high_cod_risk: activePolicy.prepaidDiscountOnHighCodRisk ?? true,
      human_approval_above_paise: activePolicy.humanApprovalAbovePaise ?? 1500000,
    };

    const inventorySnapshot = {
      sku: dbProduct.sku,
      available_qty: dbProduct.inventoryQty ?? 41,
      reserved_qty: 0,
      warehouse_location: dbProduct.warehouseLocation || 'BLR-WH-01',
    };

    try {
      const negotiationResult = await processOfferNegotiation(
        cco.buyer_constraints,
        productSnapshot,
        policyConfig,
        inventorySnapshot
      );

      const winningOffer = negotiationResult.winning_offer;
      const offerId = winningOffer.offer_id;

      // Cryptographic Contract Signing
      const contractPayload = {
        offer_id: offerId,
        buyer_agent_id: cco.intent.buyer_agent_id,
        merchant_id: merchant.id,
        sku: winningOffer.sku,
        quantity: winningOffer.quantity,
        final_price_paise: winningOffer.final_price_paise,
        currency: 'INR',
        payment_methods_allowed: winningOffer.payment_methods_allowed,
        delivery_promise: winningOffer.delivery_promise,
        return_terms_days: winningOffer.return_terms_days,
        expires_at: winningOffer.expires_at,
        policy_version: activePolicy.policyVersion || 'v1',
      };

      const signedContract = sign(contractPayload);

      // Determine Lifecycle State
      let targetState = negotiationResult.requires_human_approval ? 'APPROVAL_PENDING' : 'POLICY_APPROVED';
      signedContract.status = targetState as any;

      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'EVALUATE_CANDIDATE_OFFERS',
        actor: `buyer_agent:${cco.intent.buyer_agent_id}`,
        input_data: { sku: productSnapshot.sku, quantity: winningOffer.quantity },
        policy_version: activePolicy.policyVersion || 'v1',
        policy_checked: 'MARGIN_FLOOR_AND_DISCOUNT_CEILING',
        reason: negotiationResult.explanation,
      });

      if (negotiationResult.requires_human_approval) {
        stateMachine.transition(offerId, 'APPROVAL_PENDING', {
          action: 'HIGH_VALUE_THRESHOLD_EXCEEDED',
          actor: 'policy_engine:rule_human_approval',
          input_data: { order_total_paise: winningOffer.final_price_paise * winningOffer.quantity, threshold: activePolicy.humanApprovalAbovePaise },
          policy_version: activePolicy.policyVersion || 'v1',
          policy_checked: 'RULE_HUMAN_APPROVAL_THRESHOLD',
          reason: `Total order amount exceeds auto-approval threshold. Held for human review.`,
        });
      } else {
        stateMachine.transition(offerId, 'POLICY_APPROVED', {
          action: 'CRYPTOGRAPHIC_CONTRACT_SEALED',
          actor: `contract_service:key_v1_hmac_sha256`,
          input_data: { signature: signedContract.signature, nonce: signedContract.nonce },
          policy_version: activePolicy.policyVersion || 'v1',
          policy_checked: 'RULE_HMAC_SHA256_INTEGRITY',
          reason: 'Offer verified policy-compliant and sealed into an immutable HMAC contract ticket.',
        });
      }

      // Persist to DB asynchronously
      if (process.env.NODE_ENV !== 'test') {
        prisma.offer.create({
          data: {
            id: offerId,
            merchantId: merchant.id,
            buyerAgentId: cco.intent.buyer_agent_id,
            sku: dbProduct.sku,
            quantity: winningOffer.quantity,
            finalPricePaise: winningOffer.final_price_paise,
            discountPaise: winningOffer.discount_paise,
            discountReason: winningOffer.discount_reason,
            deliveryPromise: new Date(winningOffer.delivery_promise),
            returnTermsDays: winningOffer.return_terms_days,
            paymentMethodsAllowed: winningOffer.payment_methods_allowed,
            expiresAt: new Date(winningOffer.expires_at),
            policyVersion: activePolicy.policyVersion || 'v1',
            status: targetState,
          },
        }).catch(() => {});

        prisma.offerContract.create({
          data: {
            id: crypto.randomUUID(),
            offerId: offerId,
            merchantId: merchant.id,
            buyerAgentId: cco.intent.buyer_agent_id,
            canonicalPayload: signedContract.canonical_payload as any,
            signature: signedContract.signature,
            signingKeyId: signedContract.signing_key_id,
            nonce: signedContract.nonce,
            status: signedContract.status,
          },
        }).catch(() => {});
      }

      // Store in activeContracts map
      activeContracts.set(offerId, signedContract);

      cco.offer = winningOffer;
      cco.authorization = {
        signature: signedContract.signature,
        signing_key_id: signedContract.signing_key_id,
        nonce: signedContract.nonce,
        signed_at: signedContract.signed_at,
      };
      cco.fulfillment.state = targetState as any;

      // Add to live feed
      negotiationFeed.unshift({
        offer_id: offerId,
        cco,
        negotiation: negotiationResult,
        created_at: new Date().toISOString(),
      });

      return reply.status(200).send({
        success: true,
        cco,
        signed_contract: signedContract,
        negotiation: negotiationResult,
        explanation: negotiationResult.explanation,
        offer: winningOffer,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown offer generation error';
      return reply.status(422).send({
        success: false,
        error: `Failed to generate policy-compliant offer: ${message}`,
      });
    }
  });

  // 2. Human Approval endpoint
  fastify.post('/api/offers/:id/human-approve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireMerchantRole(request, reply)) return;
    const params = request.params as { id: string };
    const offerId = params.id;
    const body = request.body as { approver_name?: string; notes?: string };
    const approverName = body?.approver_name || 'merchant_admin_akash';

    const currentState = stateMachine.getCurrentState(offerId);
    if (currentState !== 'APPROVAL_PENDING') {
      return reply.status(400).send({
        success: false,
        error: `Cannot approve offer: current state is "${currentState}", expected "APPROVAL_PENDING".`,
      });
    }

    const signedContract = activeContracts.get(offerId);
    if (!signedContract) {
      return reply.status(404).send({ success: false, error: 'Signed contract not found' });
    }

    stateMachine.transition(offerId, 'POLICY_APPROVED', {
      action: 'HUMAN_APPROVAL_GRANTED',
      actor: `human:${approverName}`,
      input_data: { approver: approverName, notes: body?.notes || 'Manual approval granted for high-value order' },
      policy_version: signedContract.canonical_payload.policy_version,
      policy_checked: 'RULE_HUMAN_APPROVAL_THRESHOLD_OVERRIDE',
      reason: `Human merchant approver "${approverName}" authorized this offer over the threshold.`,
    });

    signedContract.status = 'POLICY_APPROVED';
    activeContracts.set(offerId, signedContract);

    if (process.env.NODE_ENV !== 'test') {
      prisma.offer.update({
        where: { id: offerId },
        data: { status: 'POLICY_APPROVED' },
      }).catch(() => {});
    }

    return reply.status(200).send({
      success: true,
      status: 'POLICY_APPROVED',
      offer_id: offerId,
      contract: signedContract,
    });
  });

  // 3. Human Reject endpoint
  fastify.post('/api/offers/:id/human-reject', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireMerchantRole(request, reply)) return;
    const params = request.params as { id: string };
    const offerId = params.id;
    const body = request.body as { approver_name?: string; rejection_reason?: string };
    const approverName = body?.approver_name || 'merchant_admin_akash';

    const currentState = stateMachine.getCurrentState(offerId);
    if (currentState !== 'APPROVAL_PENDING') {
      return reply.status(400).send({
        success: false,
        error: `Cannot reject offer: current state is "${currentState}", expected "APPROVAL_PENDING".`,
      });
    }

    const signedContract = activeContracts.get(offerId);

    stateMachine.transition(offerId, 'FAILED', {
      action: 'HUMAN_APPROVAL_REJECTED',
      actor: `human:${approverName}`,
      input_data: { approver: approverName, reason: body?.rejection_reason || 'Order value exceeds risk tolerance' },
      policy_version: signedContract?.canonical_payload.policy_version || 'v1',
      policy_checked: 'RULE_HUMAN_APPROVAL_THRESHOLD_REJECTION',
      reason: `Human merchant approver "${approverName}" rejected this offer.`,
    });

    if (signedContract) {
      signedContract.status = 'REJECTED';
      activeContracts.set(offerId, signedContract);
    }

    if (process.env.NODE_ENV !== 'test') {
      prisma.offer.update({
        where: { id: offerId },
        data: { status: 'FAILED' },
      }).catch(() => {});
    }

    return reply.status(200).send({
      success: true,
      status: 'FAILED',
      offer_id: offerId,
      reason: body?.rejection_reason || 'Rejected by merchant manager',
    });
  });

  // 3b. Pending Approvals Queue endpoint (Strictly excludes approved/rejected/failed orders)
  fastify.get('/api/offers/pending-approvals', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireMerchantRole(request, reply)) return;
    const pendingContracts = Array.from(activeContracts.values()).filter((c) => {
      const offerId = c.canonical_payload?.offer_id || c.offer_id;
      const contractStatus = (c.status as string) || '';
      const stateStatus = stateMachine.getCurrentState(offerId) || '';

      // If approved, rejected, failed, or past policy approval, exclude immediately
      if (
        contractStatus === 'POLICY_APPROVED' ||
        contractStatus === 'REJECTED' ||
        contractStatus === 'FAILED' ||
        stateStatus === 'POLICY_APPROVED' ||
        stateStatus === 'FAILED' ||
        stateStatus === 'OFFER_ACCEPTED' ||
        stateStatus === 'PAID'
      ) {
        return false;
      }

      return contractStatus === 'APPROVAL_PENDING' || stateStatus === 'APPROVAL_PENDING';
    }).map((c) => {
      const p = c.canonical_payload;
      return {
        offer_id: p?.offer_id || c.offer_id,
        sku: p?.sku || 'SPRINTPRO-X2',
        quantity: p?.quantity || 1,
        final_price_paise: p?.final_price_paise || 394900,
        total_order_paise: (p?.final_price_paise || 394900) * (p?.quantity || 1),
        delivery_promise: p?.delivery_promise || new Date().toISOString(),
        return_terms_days: p?.return_terms_days || 10,
        payment_methods_allowed: p?.payment_methods_allowed || ['UPI', 'Card'],
        expires_at: p?.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        policy_version: p?.policy_version || 'v1',
        signed_at: c.signed_at || new Date().toISOString(),
        status: 'APPROVAL_PENDING',
      };
    });

    return reply.status(200).send({
      success: true,
      pending_count: pendingContracts.length,
      offers: pendingContracts,
      pending_offers: pendingContracts,
    });
  });

  // 4. Offer Acceptance endpoint (Requires full signed contract)
  fastify.post('/api/offers/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const offerId = params.id;
    const body = request.body as {
      signed_contract?: SignedOfferContract;
      live_inventory_override?: number;
    };

    const signedContract = body?.signed_contract || activeContracts.get(offerId);
    if (!signedContract) {
      return reply.status(400).send({
        success: false,
        error: 'Full signed_contract is required in request body.',
      });
    }

    if (signedContract.canonical_payload?.offer_id !== offerId && signedContract.offer_id !== offerId) {
      return reply.status(400).send({
        success: false,
        error: `Offer ID mismatch: URL specifies "${offerId}" but contract is for "${signedContract.offer_id}".`,
      });
    }

    // Step 1: Cryptographic Signature Verification
    const verification = verify(signedContract);
    if (!verification.valid) {
      try {
        stateMachine.transition(offerId, 'FAILED', {
          action: 'ACCEPT_SIGNATURE_VERIFICATION_FAILED',
          actor: `buyer_agent:${signedContract.buyer_agent_id || 'unknown'}`,
          input_data: { signed_contract: signedContract },
          policy_version: signedContract.canonical_payload?.policy_version || 'v1',
          policy_checked: 'RULE_CRYPTOGRAPHIC_SIGNATURE_VERIFICATION',
          reason: verification.reason || 'Invalid signature detected on contract acceptance.',
        });
      } catch {}

      return reply.status(422).send({
        success: false,
        error: verification.reason || 'Invalid contract signature (tampering detected).',
        code: 'SIGNATURE_VERIFICATION_FAILED',
      });
    }

    const payload = signedContract.canonical_payload;

    // Step 2: Expiry Verification
    const expiryTime = new Date(payload.expires_at).getTime();
    if (Date.now() >= expiryTime) {
      try {
        stateMachine.transition(offerId, 'EXPIRED', {
          action: 'ACCEPT_EXPIRY_CHECK_FAILED',
          actor: `buyer_agent:${payload.buyer_agent_id}`,
          input_data: { expires_at: payload.expires_at },
          policy_version: payload.policy_version,
          policy_checked: 'RULE_OFFER_NOT_EXPIRED',
          reason: `Offer expired at ${payload.expires_at}.`,
        });
      } catch {}

      return reply.status(410).send({
        success: false,
        error: `Offer has expired at ${payload.expires_at}.`,
        code: 'OFFER_EXPIRED',
      });
    }

    // Step 3: Nonce Replay Verification
    if (nonceStore.isNonceConsumed(payload.nonce)) {
      return reply.status(409).send({
        success: false,
        error: 'Nonce already consumed - replay prohibited.',
        code: 'NONCE_ALREADY_CONSUMED',
      });
    }

    // Step 4: Live Inventory & Catalog Price Re-Check
    const catMerchant = CATALOG_MERCHANTS.find((m) => m.id === payload.merchant_id || m.slug === 'sprint-athletics');
    const catProduct = catMerchant?.products.find((p) => p.sku === payload.sku);

    const availableQty = body.live_inventory_override !== undefined
      ? body.live_inventory_override
      : catProduct?.inventoryQty ?? 41;

    if (availableQty < payload.quantity || availableQty <= 0) {
      try {
        stateMachine.transition(offerId, 'EXPIRED', {
          action: 'ACCEPT_LIVE_INVENTORY_CHECK_FAILED',
          actor: 'system:accept_verifier',
          input_data: { requested: payload.quantity, available: availableQty },
          policy_version: payload.policy_version,
          policy_checked: 'RULE_INVENTORY_AVAILABLE',
          reason: `Insufficient inventory at accept-time (${availableQty} available vs ${payload.quantity} requested). Offer expired cleanly without charge.`,
        });
      } catch {}

      return reply.status(409).send({
        success: false,
        error: `Insufficient inventory at accept-time (${availableQty} available vs ${payload.quantity} requested). Offer expired cleanly without charge.`,
        code: 'INSUFFICIENT_INVENTORY',
      });
    }

    // Decrement inventory in catalog & database
    if (catProduct) {
      catProduct.inventoryQty -= payload.quantity;
    }
    if (process.env.NODE_ENV !== 'test') {
      prisma.product.updateMany({
        where: { sku: payload.sku },
        data: { inventoryQty: { decrement: payload.quantity } },
      }).catch(() => {});
    }

    // Step 5: Mark Nonce Consumed & Contract State ACCEPTED
    const consumed = nonceStore.consumeNonce(payload.nonce, offerId);
    if (!consumed) {
      return reply.status(409).send({
        success: false,
        error: 'Failed to consume nonce (concurrency race condition).',
        code: 'NONCE_CONSUME_RACE',
      });
    }

    // State Transition: POLICY_APPROVED -> OFFER_ACCEPTED
    stateMachine.transition(offerId, 'OFFER_ACCEPTED', {
      action: 'OFFER_ACCEPTED_BY_BUYER',
      actor: `buyer_agent:${payload.buyer_agent_id}`,
      input_data: {
        sku: payload.sku,
        quantity: payload.quantity,
        final_price_paise: payload.final_price_paise,
        nonce: payload.nonce,
      },
      policy_version: payload.policy_version,
      policy_checked: 'RULE_SIGNATURE_VERIFIED_AND_NONCE_CONSUMED',
      reason: 'Buyer accepted offer with valid cryptographic HMAC signature, unexpired window, and verified live inventory.',
    });

    signedContract.status = 'CONSUMED';
    signedContract.consumed_at = new Date().toISOString();
    activeContracts.set(offerId, signedContract);

    if (process.env.NODE_ENV !== 'test') {
      prisma.offer.update({
        where: { id: offerId },
        data: { status: 'OFFER_ACCEPTED' },
      }).catch(() => {});
    }

    return reply.status(200).send({
      success: true,
      status: 'OFFER_ACCEPTED',
      offer_id: offerId,
      contract: signedContract,
      ready_for_payment: true,
      amount_paise: payload.final_price_paise * payload.quantity,
    });
  });

  // 5. Merchant Policy Endpoints
  fastify.get('/api/merchants/:slug/policy', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { slug: string };
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === params.slug);
    if (!merchant) {
      return reply.status(404).send({ success: false, error: 'Merchant not found' });
    }

    return reply.status(200).send({
      success: true,
      merchant_name: merchant.name,
      active_policy: merchant.policy,
      policy_history: merchant.policyHistory,
    });
  });

  fastify.post('/api/merchants/:slug/policy', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireMerchantRole(request, reply)) return;
    const params = request.params as { slug: string };
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === params.slug);
    if (!merchant) {
      return reply.status(404).send({ success: false, error: 'Merchant not found' });
    }

    const body = request.body as any;
    if (!body) {
      return reply.status(400).send({ success: false, error: 'Policy body required' });
    }

    const currentVersionStr = merchant.policy.policyVersion || 'v1';
    const currentVerNum = parseInt(currentVersionStr.replace(/\D/g, ''), 10) || 1;
    const nextVersionStr = `v${currentVerNum + 1}`;

    const newPolicy = {
      policyVersion: nextVersionStr,
      minMarginPct: typeof body.min_margin_pct === 'number' ? body.min_margin_pct : merchant.policy.minMarginPct,
      maxDiscountPct: typeof body.max_discount_pct === 'number' ? body.max_discount_pct : merchant.policy.maxDiscountPct,
      freeDeliveryAbovePaise: typeof body.free_delivery_above_paise === 'number' ? body.free_delivery_above_paise : merchant.policy.freeDeliveryAbovePaise,
      noDiscountFastMoving: typeof body.no_discount_fast_moving === 'boolean' ? body.no_discount_fast_moving : merchant.policy.noDiscountFastMoving,
      clearWithinDays: typeof body.clear_within_days === 'number' ? body.clear_within_days : merchant.policy.clearWithinDays,
      prepaidDiscountOnHighCodRisk: typeof body.prepaid_discount_on_high_cod_risk === 'boolean' ? body.prepaid_discount_on_high_cod_risk : merchant.policy.prepaidDiscountOnHighCodRisk,
      humanApprovalAbovePaise: typeof body.human_approval_above_paise === 'number' ? body.human_approval_above_paise : merchant.policy.humanApprovalAbovePaise,
      updatedAt: new Date().toISOString(),
      updatedBy: body.updated_by || 'merchant_admin',
    };

    merchant.policyHistory.unshift({ ...merchant.policy });
    merchant.policy = newPolicy;

    stateMachine.transition(`merchant_policy_${merchant.slug}`, 'POLICY_APPROVED', {
      action: 'POLICY_VERSION_INCREMENTED',
      actor: body.updated_by ? `human:${body.updated_by}` : 'human:merchant_admin',
      input_data: newPolicy,
      policy_version: nextVersionStr,
      policy_checked: 'RULE_MERCHANT_POLICY_UPDATE',
      reason: `Merchant ${merchant.name} updated policy parameters. New immutable policy version ${nextVersionStr} activated.`,
    });

    return reply.status(201).send({
      success: true,
      message: `Policy successfully updated to version ${nextVersionStr}`,
      active_policy: newPolicy,
      policy_history: merchant.policyHistory,
    });
  });

  // 6. Catalog CSV Import Endpoint
  fastify.post('/api/catalog/import-csv', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireMerchantRole(request, reply)) return;
    const body = request.body as { csv_content: string; merchant_slug?: string };
    if (!body || !body.csv_content) {
      return reply.status(400).send({ success: false, error: 'csv_content string is required' });
    }

    const merchantSlug = body.merchant_slug || 'sprint-athletics';
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === merchantSlug);

    if (!merchant) {
      return reply.status(404).send({ success: false, error: `Merchant "${merchantSlug}" not found` });
    }

    const importResult = importCatalogFromCsv(body.csv_content);

    // Merge into in-memory merchant catalog
    for (const validProduct of importResult.validRows) {
      const existingIdx = merchant.products.findIndex((p) => p.sku === validProduct.sku);
      const productData = {
        sku: validProduct.sku,
        name: validProduct.name,
        category: validProduct.category,
        costPaise: validProduct.costPaise,
        listPricePaise: validProduct.listPricePaise,
        inventoryQty: validProduct.inventoryQty,
        movementRate: validProduct.movementRate,
        expiryDate: validProduct.expiryDate,
        warehouseLocation: validProduct.warehouseLocation,
        clearanceFlag: validProduct.clearanceFlag,
      };

      if (existingIdx >= 0) {
        merchant.products[existingIdx] = productData;
      } else {
        merchant.products.push(productData);
      }
    }

    return reply.status(200).send({
      success: true,
      imported_count: importResult.validRows.length,
      rejected_count: importResult.errors.length,
      rejected_rows: importResult.errors.map((e) => ({
        row: e.rowNumber,
        sku: e.sku,
        field: e.field,
        reason: e.message,
      })),
      valid_products: importResult.validRows,
      summary: `Successfully parsed ${importResult.validRows.length} valid products (${importResult.errors.length} rejected).`,
    });
  });

  // 7. Get Catalog Products
  fastify.get('/api/merchants/:slug/catalog', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { slug: string };
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === params.slug);

    if (!merchant) {
      return reply.status(404).send({ success: false, error: 'Merchant not found' });
    }

    return reply.status(200).send({
      success: true,
      merchant_name: merchant.name,
      products: merchant.products,
    });
  });

  // 8. Live Feed endpoint for negotiation stream
  fastify.get('/api/offers/live-feed', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      feed: negotiationFeed.slice(0, 20),
    });
  });
}
