import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../index.js';
import { FastifyInstance } from 'fastify';

describe('Server-Side Role Enforcement & Buyer Orders API', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();
  });

  it('rejects buyer calls to merchant pending approvals endpoint with 403 Forbidden', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
      headers: {
        'x-user-role': 'buyer',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.error).toContain('Merchant role required');
  });

  it('rejects buyer calls to human approve endpoint with 403 Forbidden', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/offers/off-test-001/human-approve',
      headers: {
        'x-user-role': 'buyer',
      },
      payload: {
        approver_name: 'buyer_attempting_approval',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('rejects buyer calls to catalog csv import with 403 Forbidden', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/catalog/import-csv',
      headers: {
        'x-user-role': 'buyer',
      },
      payload: {
        csv_content: 'sku,name\nSP1,Test',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('allows merchant caller to access merchant endpoints', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
      headers: {
        'x-user-role': 'merchant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });

  it('returns scoped buyer orders with only buyer-safe fields (zero margins/cost fields)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/buyer/orders?buyer_agent_id=buyer-agent-sim-01',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.orders)).toBe(true);

    // If orders exist, confirm buyer-safe invariants
    if (body.orders.length > 0) {
      const order = body.orders[0];
      expect(order).toHaveProperty('order_id');
      expect(order).toHaveProperty('product_name');
      expect(order).toHaveProperty('amount_paid_paise');
      expect(order).toHaveProperty('delivery_promise');
      expect(order).toHaveProperty('return_terms_days');
      expect(order).toHaveProperty('status');

      // Invariant: Never leak merchant-confidential numbers to buyer
      expect(order).not.toHaveProperty('cost_paise');
      expect(order).not.toHaveProperty('gross_profit_paise');
      expect(order).not.toHaveProperty('margin_pct');
      expect(order).not.toHaveProperty('expected_profit_score');
    }
  });
});
