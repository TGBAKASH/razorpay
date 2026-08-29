import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  type BuyerConstraintsSection,
} from '@razorpay-dealflow/adapters';
import {
  processOfferNegotiation,
  evaluateBuyerMultiAttributeUtility,
  type CompetingMerchantBid,
} from '@razorpay-dealflow/offer-engine';
import { sign } from '@razorpay-dealflow/contract-service';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';
import { activeContracts } from './offers.js';
import { stateMachine } from '../services/state-machine.js';

export async function registerAuctionRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auction/broadcast', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      category?: string;
      buyer_agent_id?: string;
      buyer_constraints?: BuyerConstraintsSection;
    };

    const buyerConstraints: BuyerConstraintsSection = body?.buyer_constraints || {
      quantity: 20,
      budget_max_paise: 3000000, // ₹30,000 per unit
      currency: 'INR',
      delivery_deadline: '2026-09-04T23:59:59Z', // Friday
      payment_preference: ['upi', 'card'],
      return_preference: 'flexible',
      priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
    };

    const buyerAgentId = body?.buyer_agent_id || 'buyer-sim-auction-01';

    // 1. Identify participating merchants for the category (Merchants A, B, and C)
    const participatingMerchants = CATALOG_MERCHANTS.filter((m) =>
      ['merchant-a-crafts', 'merchant-b-bulk', 'merchant-c-express'].includes(m.slug)
    );

    if (participatingMerchants.length === 0) {
      return reply.status(500).send({
        success: false,
        error: 'Participating gift-box merchants (A, B, C) not configured',
      });
    }

    const now = new Date();

    // 2. Parallel Fan-Out Broadcast: Each merchant runs Phases 3-5 independently
    const merchantBidPromises = participatingMerchants.map(async (merchant) => {
      const product = merchant.products[0]!;
      const productSnapshot = {
        sku: product.sku,
        name: product.name,
        cost_paise: product.costPaise,
        list_price_paise: product.listPricePaise,
        movement_rate: product.movementRate,
        expiry_date: product.expiryDate || null,
        warehouse_location: product.warehouseLocation,
        clearance_flag: product.clearanceFlag,
      };

      const policyConfig = {
        policy_version: merchant.policy.policyVersion,
        min_margin_pct: merchant.policy.minMarginPct,
        max_discount_pct: merchant.policy.maxDiscountPct,
        free_delivery_above_paise: merchant.policy.freeDeliveryAbovePaise,
        no_discount_fast_moving: merchant.policy.noDiscountFastMoving,
        clear_within_days: merchant.policy.clearWithinDays,
        prepaid_discount_on_high_cod_risk: merchant.policy.prepaidDiscountOnHighCodRisk,
        human_approval_above_paise: merchant.policy.humanApprovalAbovePaise,
      };

      const carrierSlaDays = merchant.slug === 'merchant-c-express' ? 0 : merchant.slug === 'merchant-a-crafts' ? 1 : 2;

      const inventorySnapshot = {
        sku: product.sku,
        available_qty: product.inventoryQty,
        warehouse_location: product.warehouseLocation,
        carrier_sla_days: { [product.warehouseLocation]: carrierSlaDays },
      };

      // Run merchant's deterministic policy check and offer engine
      const negotiationResult = await processOfferNegotiation(
        buyerConstraints,
        productSnapshot,
        policyConfig,
        inventorySnapshot,
        now
      );

      const winning = negotiationResult.winning_offer;

      // Cryptographically sign the merchant's contract
      const signedContract = sign({
        offer_id: winning.offer_id,
        buyer_agent_id: buyerAgentId,
        merchant_id: merchant.id,
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

      // Determine delivery label and extras description
      let dayLabel = 'Friday';
      let extrasDesc = 'Standard corporate packaging';
      if (merchant.slug === 'merchant-a-crafts') {
        dayLabel = 'Thursday';
        extrasDesc = 'Free custom logo laser engraving & branding';
      } else if (merchant.slug === 'merchant-b-bulk') {
        dayLabel = 'Friday';
        extrasDesc = 'Standard packaging (no customization)';
      } else if (merchant.slug === 'merchant-c-express') {
        dayLabel = 'Wednesday';
        extrasDesc = '15-day replacement warranty & express air courier';
      }

      return {
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        sku: product.sku,
        product_name: product.name,
        unit_price_paise: winning.final_price_paise,
        total_price_paise: winning.final_price_paise * winning.quantity,
        discount_paise: winning.discount_paise,
        delivery_promise: winning.delivery_promise,
        delivery_day_label: dayLabel,
        return_terms_days: winning.return_terms_days,
        extras_description: extrasDesc,
        signed_contract: signedContract,
      };
    });

    const rawBids = await Promise.all(merchantBidPromises);

    // 3. Multi-Attribute Decision Function: Score candidate bids using buyer's priority ranking
    const auctionResult = evaluateBuyerMultiAttributeUtility(
      rawBids,
      buyerConstraints.priorities,
      buyerConstraints.budget_max_paise
    );

    // 4. Register winning contract into activeContracts so it proceeds seamlessly to Phase 6
    const winningBid: CompetingMerchantBid = auctionResult.winner;
    const winningOfferId = winningBid.signed_contract.canonical_payload.offer_id;
    activeContracts.set(winningOfferId, winningBid.signed_contract);

    stateMachine.setCurrentState(winningOfferId, 'REQUEST_RECEIVED');
    stateMachine.transition(winningOfferId, 'OFFER_GENERATED', {
      action: 'AUCTION_WINNER_SELECTED',
      actor: `buyer_agent:${buyerAgentId}`,
      input_data: {
        winning_merchant: winningBid.merchant_name,
        priorities: buyerConstraints.priorities,
        unit_price_paise: winningBid.unit_price_paise,
        utility_score: winningBid.utility_scores.total_utility,
      },
      policy_version: winningBid.signed_contract.canonical_payload.policy_version,
      policy_checked: 'RULE_MULTI_ATTRIBUTE_AUCTION_DECISION',
      reason: auctionResult.decision_rationale,
    });

    stateMachine.transition(winningOfferId, 'POLICY_APPROVED', {
      action: 'AUCTION_WINNING_CONTRACT_COMMITTED',
      actor: 'system:auction_coordinator',
      input_data: {
        offer_id: winningOfferId,
        merchant: winningBid.merchant_name,
        total_amount_paise: winningBid.total_price_paise,
      },
      policy_version: winningBid.signed_contract.canonical_payload.policy_version,
      policy_checked: 'RULE_AUCTION_SETTLEMENT_COMMITTAL',
      reason: `Committed signed contract from ${winningBid.merchant_name} for Phase 6 Razorpay settlement.`,
    });

    return reply.status(200).send({
      success: true,
      auction: auctionResult,
      winning_contract: winningBid.signed_contract,
    });
  });
}
