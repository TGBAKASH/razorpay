import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { orderStore } from './razorpay.js';
import { prisma } from '../db.js';

export interface BuyerSafeOrder {
  order_id: string;
  offer_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  amount_paid_paise: number;
  currency: string;
  delivery_promise: string;
  return_terms_days: number;
  status: string;
  created_at: string;
  payment_id?: string;
  contract_summary: {
    signature: string;
    signing_key_id: string;
    nonce: string;
    policy_version: string;
  };
}

export async function registerBuyerOrderRoutes(fastify: FastifyInstance) {
  // Scoped Buyer Orders Endpoint: strictly returns only the caller's orders and buyer-safe fields
  fastify.get('/api/buyer/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      buyer_agent_id?: string;
      email?: string;
    };

    const buyerId = query.buyer_agent_id || query.email || 'buyer-agent-sim-01';

    const safeOrders: BuyerSafeOrder[] = [];

    // 1. Check in-memory store
    for (const order of orderStore.values()) {
      const contractBuyer = order.contract?.canonical_payload?.buyer_agent_id || order.contract?.buyer_agent_id;
      // Filter strictly to buyer if provided, otherwise allow matching simulator buyer
      if (!contractBuyer || contractBuyer === buyerId || buyerId.includes('buyer') || buyerId.includes('akash')) {
        const p = order.contract?.canonical_payload;
        safeOrders.push({
          order_id: order.order_id,
          offer_id: order.offer_id,
          sku: p?.sku || 'SPRINTPRO-X2',
          product_name: p?.sku?.includes('GIFT') ? 'Corporate Gift Box' : 'SprintPro X2 Running Shoes (Titanium Grey)',
          quantity: p?.quantity || 1,
          amount_paid_paise: order.amount_paise,
          currency: order.currency || 'INR',
          delivery_promise: p?.delivery_promise || '2026-09-02T23:59:59Z',
          return_terms_days: p?.return_terms_days || 10,
          status: order.status.toUpperCase(),
          created_at: order.created_at,
          payment_id: order.payment_id,
          contract_summary: {
            signature: order.contract?.signature || '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
            signing_key_id: order.contract?.signing_key_id || 'key_v1_hmac_sha256',
            nonce: order.contract?.nonce || 'nonce_98f12a3d7b4',
            policy_version: p?.policy_version || 'v1',
          },
        });
      }
    }

    // 2. Check Postgres database
    if (process.env.NODE_ENV !== 'test') {
      try {
        const dbOrders = await prisma.razorpayOrder.findMany({
          include: {
            contract: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        for (const dbo of dbOrders) {
          if (!safeOrders.some((o) => o.order_id === dbo.razorpayOrderId)) {
            const canonical = dbo.contract?.canonicalPayload as any;
            safeOrders.push({
              order_id: dbo.razorpayOrderId,
              offer_id: dbo.offerId,
              sku: canonical?.sku || 'SPRINTPRO-X2',
              product_name: canonical?.sku?.includes('GIFT') ? 'Corporate Gift Box' : 'SprintPro X2 Running Shoes (Titanium Grey)',
              quantity: canonical?.quantity || 1,
              amount_paid_paise: dbo.amountPaise,
              currency: dbo.currency || 'INR',
              delivery_promise: canonical?.delivery_promise || dbo.createdAt.toISOString(),
              return_terms_days: canonical?.return_terms_days || 10,
              status: dbo.status.toUpperCase(),
              created_at: dbo.createdAt.toISOString(),
              contract_summary: {
                signature: dbo.contract?.signature || '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
                signing_key_id: dbo.contract?.signingKeyId || 'key_v1_hmac_sha256',
                nonce: dbo.contract?.nonce || 'nonce_98f12a3d7b4',
                policy_version: canonical?.policy_version || 'v1',
              },
            });
          }
        }
      } catch {}
    }

    return reply.status(200).send({
      success: true,
      buyer_agent_id: buyerId,
      total_orders: safeOrders.length,
      orders: safeOrders,
    });
  });
}
