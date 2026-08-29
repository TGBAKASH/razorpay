import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../index.js';
import { FastifyInstance } from 'fastify';

describe('Order Reviews Persistence & Strict Queue Filtering', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('approves a pending high-value offer and confirms it no longer appears in pending-approvals queue', async () => {
    // 1. Generate an offer requiring human approval (Bulk quantity 10 = ₹39,490 > ₹15,000 threshold)
    const genRes = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        sku: 'SPRINTPRO-X2',
        buyer_constraints: {
          quantity: 10,
          budget_max_paise: 4000000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
        },
      },
    });

    expect(genRes.statusCode).toBe(200);
    const genBody = JSON.parse(genRes.body);
    const offerId = genBody.offer.offer_id;
    expect(genBody.signed_contract.status).toBe('APPROVAL_PENDING');

    // 2. Query Pending Approvals Queue
    const queueBeforeRes = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
    });
    expect(queueBeforeRes.statusCode).toBe(200);
    const queueBefore = JSON.parse(queueBeforeRes.body);
    const foundBefore = queueBefore.offers.find((o: any) => o.offer_id === offerId);
    expect(foundBefore).toBeDefined();

    // 3. Human Merchant Approver authorizes the offer
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/human-approve`,
      payload: {
        approver_name: 'merchant_admin_akash',
        notes: 'Authorized bulk team order override',
      },
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.status).toBe('POLICY_APPROVED');

    // 4. Query Pending Approvals Queue Again (simulate navigating away and back)
    const queueAfterRes = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
    });
    expect(queueAfterRes.statusCode).toBe(200);
    const queueAfter = JSON.parse(queueAfterRes.body);
    const foundAfter = queueAfter.offers.find((o: any) => o.offer_id === offerId);

    // MUST be strictly excluded from the queue
    expect(foundAfter).toBeUndefined();
  });

  it('rejects a pending offer and confirms it does not appear in pending-approvals queue', async () => {
    // 1. Generate another offer requiring approval
    const genRes = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        sku: 'SPRINTPRO-X2',
        buyer_constraints: {
          quantity: 10,
          budget_max_paise: 4000000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          payment_preference: ['card'],
          return_preference: 'easy returns',
          priorities: ['price'],
        },
      },
    });

    const genBody = JSON.parse(genRes.body);
    const offerId = genBody.offer.offer_id;

    // 2. Human Merchant Approver rejects the offer
    const rejectRes = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/human-reject`,
      payload: {
        approver_name: 'merchant_admin_akash',
        rejection_reason: 'Exceeds warehouse single-order capacity',
      },
    });
    expect(rejectRes.statusCode).toBe(200);

    // 3. Confirm excluded from pending approvals queue
    const queueRes = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
    });
    const queue = JSON.parse(queueRes.body);
    const found = queue.offers.find((o: any) => o.offer_id === offerId);
    expect(found).toBeUndefined();
  });
});
