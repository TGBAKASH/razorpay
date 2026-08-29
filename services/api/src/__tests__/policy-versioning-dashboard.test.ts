import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';
import { stateMachine } from '../services/state-machine.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';

describe('Merchant Policy Versioning & Dashboard Endpoints (Phase 8)', () => {
  const server = buildServer();

  beforeEach(() => {
    stateMachine.reset();
    nonceStore.reset();
    // Reset sprint athletics merchant policy to v1 baseline
    const sprintMerchant = CATALOG_MERCHANTS.find((m) => m.slug === 'sprint-athletics')!;
    sprintMerchant.policy = {
      policyVersion: 'v1',
      minMarginPct: 18.0,
      maxDiscountPct: 12.0,
      freeDeliveryAbovePaise: 149900,
      noDiscountFastMoving: true,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 1500000,
      updatedAt: '2026-08-25T12:00:00Z',
      updatedBy: 'system:seed',
    };
    sprintMerchant.policyHistory = [];
  });

  it('updates policy max_discount_pct from 12% to 8%, increments version to v2, and caps discount accordingly', async () => {
    // 1. Initial Offer under v1 (max_discount_pct = 12%)
    const v1Res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
        },
      },
    });

    expect(v1Res.statusCode).toBe(200);
    const v1Body = JSON.parse(v1Res.body);
    expect(v1Body.signed_contract.canonical_payload.policy_version).toBe('v1');
    expect(v1Body.signed_contract.canonical_payload.discount_paise || v1Body.cco.offer.discount_paise).toBe(35000); // ₹350 discount
    expect(v1Body.cco.offer.final_price_paise).toBe(394900); // ₹3,949

    // 2. Merchant changes max_discount_pct from 12% to 8% via POST /api/merchants/sprint-athletics/policy
    const updateRes = await server.inject({
      method: 'POST',
      url: '/api/merchants/sprint-athletics/policy',
      payload: {
        max_discount_pct: 8.0, // Changed from 12% to 8%
        min_margin_pct: 18.0,
        free_delivery_above_paise: 149900,
        no_discount_fast_moving: true,
        clear_within_days: 30,
        prepaid_discount_on_high_cod_risk: true,
        human_approval_above_paise: 1500000,
        updated_by: 'merchant_admin_akash',
      },
    });

    expect(updateRes.statusCode).toBe(201);
    const updateBody = JSON.parse(updateRes.body);
    expect(updateBody.active_policy.policyVersion).toBe('v2');
    expect(updateBody.active_policy.maxDiscountPct).toBe(8.0);
    expect(updateBody.policy_history.length).toBe(1);
    expect(updateBody.policy_history[0].policyVersion).toBe('v1');

    // 3. Resubmit the exact same SprintPro X2 buyer request
    const v2Res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        buyer_constraints: {
          budget_max_paise: 400000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          quantity: 1,
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
        },
      },
    });

    expect(v2Res.statusCode).toBe(200);
    const v2Body = JSON.parse(v2Res.body);
    const v2Offer = v2Body.cco.offer;
    const v2Contract = v2Body.signed_contract;

    // Confirm policy_version is now incremented to 'v2'
    expect(v2Contract.canonical_payload.policy_version).toBe('v2');
    expect(v2Offer.policy_version).toBe('v2');

    // 8% max discount on list price 429,900 paise = floor(429,900 * 0.08) = 34,392 paise (₹343.92)
    // Confirm the discount is now strictly capped at 34,392 paise (< 35,000 paise under v1)
    expect(v2Offer.discount_paise).toBe(34392);
    expect(v2Offer.final_price_paise).toBe(395508); // ₹3,955.08
    expect(v2Offer.discount_paise).toBeLessThan(35000);

    // 4. Confirm audit trail reflects policy_version v2
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${v2Contract.offer_id}`,
    });
    const auditLogs = JSON.parse(auditRes.body).logs;
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(auditLogs[1].policy_version).toBe('v2');
  });

  it('imports catalog CSV and rejects rows with negative margin', async () => {
    const csvContent = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,warehouse_location,clearance_flag
PRO-TEST-01,Valid Test Sneaker,Footwear,100000,150000,20,normal,BLR-WH-01,false
PRO-BAD-02,Defective Loss Item,Footwear,200000,150000,10,slow,BLR-WH-01,false`;

    const res = await server.inject({
      method: 'POST',
      url: '/api/catalog/import-csv',
      payload: { csv_content: csvContent },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.imported_count).toBe(1);
    expect(body.rejected_count).toBe(1);
    expect(body.rejected_rows[0].reason).toContain('Negative margin prohibited');
  });

  it('manages human approval queue with Approve and Reject actions', async () => {
    // Generate high value bulk offer (qty = 10, total = ₹39,490 > ₹15,000 threshold)
    const res = await server.inject({
      method: 'POST',
      url: '/api/offers/generate',
      payload: {
        category: 'running shoes',
        buyer_constraints: {
          budget_max_paise: 4000000,
          currency: 'INR',
          delivery_deadline: '2026-09-01T23:59:59Z',
          quantity: 10, // 10 units = ₹39,490
          payment_preference: ['upi'],
          return_preference: 'easy returns',
          priorities: ['price', 'delivery_speed', 'return_terms', 'extras'],
        },
      },
    });

    const body = JSON.parse(res.body);
    const offerId = body.signed_contract.offer_id;
    expect(body.cco.fulfillment.state).toBe('APPROVAL_PENDING');

    // 1. Fetch pending approvals queue
    const queueRes = await server.inject({
      method: 'GET',
      url: '/api/offers/pending-approvals',
    });
    expect(queueRes.statusCode).toBe(200);
    const queueBody = JSON.parse(queueRes.body);
    expect(queueBody.pending_count).toBeGreaterThanOrEqual(1);

    // 2. Human Approver approves the offer
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/offers/${offerId}/human-approve`,
      payload: { approver_name: 'merchant_director_shreya', notes: 'Corporate client approved' },
    });

    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.status).toBe('POLICY_APPROVED');

    // 3. Confirm audit trail records the named human approver
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/audit-logs?offer_id=${offerId}`,
    });
    const logs = JSON.parse(auditRes.body).logs;
    const humanApprovalEntry = logs.find((l: any) => l.action === 'HUMAN_APPROVAL_GRANTED');
    expect(humanApprovalEntry).toBeDefined();
    expect(humanApprovalEntry.actor).toBe('human:merchant_director_shreya');
  });

  it('populates live feed of agent requests and candidate evaluations', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/offers/live-feed',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.feed)).toBe(true);
  });
});
