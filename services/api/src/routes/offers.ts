import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
import { CATALOG_MERCHANTS, type ProductData } from '../data/seed-catalog.js';
import { stateMachine } from '../services/state-machine.js';
import { importCatalogFromCsv } from '../importers/catalog-csv-importer.js';

// In-memory active contract store and live feed
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
          id: 'intent-' + Math.random().toString(36).substring(2, 9),
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

    // Identify qualifying product and merchant from catalog
    const categoryLower = cco.intent.category.toLowerCase();
    const sprintMerchant = CATALOG_MERCHANTS.find((m) => m.slug === 'sprint-athletics');
    if (!sprintMerchant) {
      return reply.status(500).send({
        success: false,
        error: 'Default merchant configuration not found',
      });
    }

    let targetProduct = sprintMerchant.products[0];
    if (categoryLower.includes('gift')) {
      const merchantA = CATALOG_MERCHANTS.find((m) => m.slug === 'merchant-a-crafts');
      if (merchantA && merchantA.products[0]) {
        targetProduct = merchantA.products[0];
      }
    }

    if (!targetProduct) {
      return reply.status(404).send({
        success: false,
        error: `No qualifying products found for category: ${cco.intent.category}`,
      });
    }

    const productSnapshot = {
      sku: targetProduct.sku,
      name: targetProduct.name,
      cost_paise: targetProduct.costPaise,
      list_price_paise: targetProduct.listPricePaise,
      movement_rate: targetProduct.movementRate,
      expiry_date: targetProduct.expiryDate || null,
      warehouse_location: targetProduct.warehouseLocation,
      clearance_flag: targetProduct.clearanceFlag,
    };

    const policyConfig = {
      policy_version: sprintMerchant.policy.policyVersion,
      min_margin_pct: sprintMerchant.policy.minMarginPct,
      max_discount_pct: sprintMerchant.policy.maxDiscountPct,
      free_delivery_above_paise: sprintMerchant.policy.freeDeliveryAbovePaise,
      no_discount_fast_moving: sprintMerchant.policy.noDiscountFastMoving,
      clear_within_days: sprintMerchant.policy.clearWithinDays,
      prepaid_discount_on_high_cod_risk: sprintMerchant.policy.prepaidDiscountOnHighCodRisk,
      human_approval_above_paise: sprintMerchant.policy.humanApprovalAbovePaise,
    };

    const inventorySnapshot = {
      sku: targetProduct.sku,
      available_qty: targetProduct.inventoryQty,
      warehouse_location: targetProduct.warehouseLocation,
      carrier_sla_days: { [targetProduct.warehouseLocation]: 2 },
    };

    try {
      const negotiationResult = await processOfferNegotiation(
        cco.buyer_constraints,
        productSnapshot,
        policyConfig,
        inventorySnapshot,
        new Date()
      );

      const winning = negotiationResult.winning_offer;
      const offerId = winning.offer_id;

      // State Transition 1: Initial state REQUEST_RECEIVED
      stateMachine.setCurrentState(offerId, 'REQUEST_RECEIVED');
      stateMachine.transition(offerId, 'OFFER_GENERATED', {
        action: 'OFFER_GENERATED_FROM_INTENT',
        actor: `buyer_agent:${cco.intent.buyer_agent_id}`,
        input_data: {
          category: cco.intent.category,
          budget_max_paise: cco.buyer_constraints.budget_max_paise,
          delivery_deadline: cco.buyer_constraints.delivery_deadline,
          payment_preference: cco.buyer_constraints.payment_preference,
          priorities: cco.buyer_constraints.priorities,
        },
        policy_version: policyConfig.policy_version,
        policy_checked: 'generateCandidateOffers',
        reason: `Generated ${negotiationResult.candidate_offers.length} candidate offers. Offer A chosen as highest expected profit score (${negotiationResult.candidate_offers[0]?.expected_profit_score.toFixed(0)}) vs alternatives under active policy ${policyConfig.policy_version}.`,
      });

      // Cryptographically sign the canonical contract payload
      const signedContract = sign({
        offer_id: winning.offer_id,
        buyer_agent_id: cco.intent.buyer_agent_id,
        merchant_id: sprintMerchant.id,
        sku: winning.sku,
        quantity: winning.quantity,
        final_price_paise: winning.final_price_paise,
        currency: 'INR',
        payment_methods_allowed: winning.payment_methods_allowed,
        delivery_promise: winning.delivery_promise,
        return_terms_days: winning.return_terms_days,
        expires_at: winning.expires_at,
        policy_version: winning.policy_version,
      });

      // Store contract in active contracts index
      activeContracts.set(winning.offer_id, signedContract);

      // State Transition 2: OFFER_GENERATED -> POLICY_APPROVED or APPROVAL_PENDING
      const targetState = negotiationResult.requires_human_approval ? 'APPROVAL_PENDING' : 'POLICY_APPROVED';
      stateMachine.transition(offerId, targetState, {
        action: negotiationResult.requires_human_approval ? 'HUMAN_APPROVAL_ROUTING' : 'POLICY_CHECK_APPROVED_AND_SIGNED',
        actor: 'system:policy_engine',
        input_data: {
          final_price_paise: winning.final_price_paise,
          discount_paise: winning.discount_paise,
          quantity: winning.quantity,
          sku: winning.sku,
          reasons: winning.discount_reason,
        },
        policy_version: policyConfig.policy_version,
        policy_checked: 'RULE_MIN_MARGIN, RULE_MAX_DISCOUNT, RULE_INVENTORY_AVAILABLE, RULE_DELIVERY_REACHABLE, RULE_OFFER_NOT_EXPIRED',
        reason: negotiationResult.explanation,
      });

      // Attach winning offer, authorization, and signed contract to CCO
      cco.offer = winning;
      cco.authorization = {
        signature: signedContract.signature,
        signing_key_id: signedContract.signing_key_id,
        nonce: signedContract.nonce,
        signed_at: signedContract.signed_at,
      };
      cco.fulfillment.state = targetState;

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
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown offer generation error';
      return reply.status(422).send({
        success: false,
        error: `Failed to generate policy-compliant offer: ${message}`,
      });
    }
  });

  // 2. Human Approval endpoint (releases APPROVAL_PENDING into POLICY_APPROVED)
  fastify.post('/api/offers/:id/human-approve', async (request: FastifyRequest, reply: FastifyReply) => {
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
      reason: `Human merchant approver "${approverName}" authorized this offer over the threshold: ${body?.notes || 'Approved high-value order.'}`,
    });

    signedContract.status = 'POLICY_APPROVED';
    activeContracts.set(offerId, signedContract);

    return reply.status(200).send({
      success: true,
      status: 'POLICY_APPROVED',
      offer_id: offerId,
      contract: signedContract,
    });
  });

  // 3. Human Reject endpoint (rejects APPROVAL_PENDING into FAILED)
  fastify.post('/api/offers/:id/human-reject', async (request: FastifyRequest, reply: FastifyReply) => {
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
      reason: `Human merchant approver "${approverName}" rejected this offer: ${body?.rejection_reason || 'Order value exceeds risk tolerance.'}`,
    });

    if (signedContract) {
      signedContract.status = 'REJECTED';
      activeContracts.set(offerId, signedContract);
    }

    return reply.status(200).send({
      success: true,
      status: 'FAILED',
      offer_id: offerId,
      reason: body?.rejection_reason || 'Rejected by merchant manager',
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

    const signedContract = body?.signed_contract;
    if (!signedContract) {
      return reply.status(400).send({
        success: false,
        error: 'Full signed_contract is required in request body (not just an ID).',
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
    const sprintMerchant = CATALOG_MERCHANTS.find((m) => m.id === payload.merchant_id || m.slug === 'sprint-athletics');
    const liveProduct = sprintMerchant?.products.find((p) => p.sku === payload.sku);

    const availableQty = body.live_inventory_override !== undefined
      ? body.live_inventory_override
      : liveProduct?.inventoryQty ?? 0;

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

    return reply.status(200).send({
      success: true,
      status: 'OFFER_ACCEPTED',
      offer_id: offerId,
      contract: signedContract,
      ready_for_payment: true,
      amount_paise: payload.final_price_paise * payload.quantity,
    });
  });

  // 5. Merchant Policy Endpoints (Versioned, immutable)
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
    const params = request.params as { slug: string };
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === params.slug);
    if (!merchant) {
      return reply.status(404).send({ success: false, error: 'Merchant not found' });
    }

    const body = request.body as any;
    if (!body) {
      return reply.status(400).send({ success: false, error: 'Policy body required' });
    }

    // Determine new version number (e.g. v1 -> v2)
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

    // Push previous version into immutable history and activate new version
    merchant.policyHistory.unshift({ ...merchant.policy });
    merchant.policy = newPolicy;

    // Log policy change to audit trail
    stateMachine.transition(`merchant_policy_${merchant.slug}`, 'POLICY_APPROVED', {
      action: 'POLICY_VERSION_INCREMENTED',
      actor: body.updated_by ? `human:${body.updated_by}` : 'human:merchant_admin',
      input_data: newPolicy,
      policy_version: nextVersionStr,
      policy_checked: 'RULE_MERCHANT_POLICY_UPDATE',
      reason: `Merchant ${merchant.name} updated policy parameters. New immutable policy version ${nextVersionStr} activated (max discount: ${newPolicy.maxDiscountPct}%, min margin: ${newPolicy.minMarginPct}%).`,
    });

    return reply.status(201).send({
      success: true,
      message: `Policy successfully updated to version ${nextVersionStr}`,
      active_policy: newPolicy,
      policy_history: merchant.policyHistory,
    });
  });

  // 6. Catalog CSV Import Endpoint (Reusing Phase 1 Importer)
  fastify.post('/api/catalog/import-csv', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { csv_content: string; merchant_slug?: string };
    if (!body || !body.csv_content) {
      return reply.status(400).send({ success: false, error: 'csv_content string is required' });
    }

    const merchantSlug = body.merchant_slug || 'sprint-athletics';
    const merchant = CATALOG_MERCHANTS.find((m) => m.slug === merchantSlug);
    if (!merchant) {
      return reply.status(404).send({ success: false, error: 'Merchant not found' });
    }

    const importResult = importCatalogFromCsv(body.csv_content);

    // Merge imported valid rows into merchant product list
    for (const validItem of importResult.validRows) {
      const productData: ProductData = {
        sku: validItem.sku,
        name: validItem.name,
        category: validItem.category,
        costPaise: validItem.costPaise,
        listPricePaise: validItem.listPricePaise,
        inventoryQty: validItem.inventoryQty,
        movementRate: validItem.movementRate,
        warehouseLocation: validItem.warehouseLocation,
        clearanceFlag: validItem.clearanceFlag,
        expiryDate: validItem.expiryDate,
      };

      const existingIdx = merchant.products.findIndex((p) => p.sku === productData.sku);
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
      valid_products: importResult.validRows,
      rejected_rows: importResult.errors.map((e) => ({
        row_index: e.rowNumber,
        sku: e.sku,
        field: e.field,
        reason: e.message,
      })),
      total_catalog_size: merchant.products.length,
    });
  });

  // 7. Get Catalog Products
  fastify.get('/api/catalog/products', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sprintMerchant = CATALOG_MERCHANTS.find((m) => m.slug === 'sprint-athletics');
    return reply.status(200).send({
      success: true,
      products: sprintMerchant?.products || [],
    });
  });

  // 8. Get Pending Approvals Queue
  fastify.get('/api/offers/pending-approvals', async (_request: FastifyRequest, reply: FastifyReply) => {
    const pendingList: any[] = [];
    for (const [offerId, contract] of activeContracts.entries()) {
      const currentState = stateMachine.getCurrentState(offerId);
      if (currentState === 'APPROVAL_PENDING') {
        const payload = contract.canonical_payload;
        pendingList.push({
          offer_id: offerId,
          sku: payload.sku,
          quantity: payload.quantity,
          final_price_paise: payload.final_price_paise,
          total_order_paise: payload.final_price_paise * payload.quantity,
          delivery_promise: payload.delivery_promise,
          return_terms_days: payload.return_terms_days,
          payment_methods_allowed: payload.payment_methods_allowed,
          expires_at: payload.expires_at,
          policy_version: payload.policy_version,
          signed_at: contract.signed_at,
        });
      }
    }

    return reply.status(200).send({
      success: true,
      pending_count: pendingList.length,
      pending_offers: pendingList,
    });
  });

  // 9. Live Feed Endpoint
  fastify.get('/api/offers/live-feed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const items = negotiationFeed.map((item) => ({
      offer_id: item.offer_id,
      category: item.cco.intent.category,
      buyer_agent_id: item.cco.intent.buyer_agent_id,
      budget_max_paise: item.cco.buyer_constraints.budget_max_paise,
      winning_price_paise: item.negotiation.winning_offer.final_price_paise,
      discount_paise: item.negotiation.winning_offer.discount_paise,
      current_state: stateMachine.getCurrentState(item.offer_id) || 'UNKNOWN',
      margin_pct: item.negotiation.margin_pct,
      explanation: item.negotiation.explanation,
      created_at: item.created_at,
      candidates_count: item.negotiation.candidate_offers.length,
    }));

    return reply.status(200).send({
      success: true,
      feed: items,
    });
  });
}
