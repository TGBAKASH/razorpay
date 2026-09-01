import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { buildServer } from '../index.js';
import { sign, nonceStore } from '@razorpay-dealflow/contract-service';
import { inventoryService } from '../services/inventory-service.js';
import { activeContracts } from '../routes/offers.js';
import { stateMachine } from '../services/state-machine.js';

describe('Concurrency-Proof Inventory & Atomic Conditional Reservation', () => {
  const server = buildServer();
  const testSku = 'SPRINTPRO-X2';
  const initialStock = 3;
  const concurrentBuyers = 25;

  beforeEach(async () => {
    nonceStore.reset();
    stateMachine.reset();
    await inventoryService.setInventory(testSku, initialStock);
  });

  afterEach(async () => {
    // Restore default catalog inventory
    await inventoryService.setInventory(testSku, 41);
  });

  it('fires 25 concurrent simulated purchase attempts against stock = 3: exactly 3 succeed, 22 receive clean sold-out declines, 0 crashes, final stock = 0', async () => {
    const now = new Date();

    // 1. Prepare 25 distinct signed contracts for 25 different buyer agents
    const contracts = Array.from({ length: concurrentBuyers }, (_, idx) => {
      const offerId = `off-concurrency-${crypto.randomUUID().substring(0, 8)}`;
      const contract = sign({
        offer_id: offerId,
        buyer_agent_id: `buyer-agent-${idx + 1}`,
        merchant_id: 'merchant-sprint-alpha',
        sku: testSku,
        quantity: 1,
        final_price_paise: 394900,
        currency: 'INR',
        payment_methods_allowed: ['upi'],
        delivery_promise: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        return_terms_days: 10,
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        policy_version: 'v1',
      });

      activeContracts.set(offerId, contract);
      stateMachine.setCurrentState(offerId, 'POLICY_APPROVED');
      return contract;
    });

    // 2. Fire all 25 purchase accept requests concurrently
    const acceptPromises = contracts.map((contract) =>
      server.inject({
        method: 'POST',
        url: `/api/offers/${contract.offer_id}/accept`,
        payload: { signed_contract: contract },
      })
    );

    const responses = await Promise.all(acceptPromises);

    // 3. Classify results
    const acceptedResponses = responses.filter((r) => r.statusCode === 200);
    const soldOutResponses = responses.filter((r) => r.statusCode === 409);
    const crashResponses = responses.filter((r) => r.statusCode >= 500);

    // Invariant Proof 1: Exactly 3 purchases succeed (100% of available inventory claimed)
    expect(acceptedResponses).toHaveLength(initialStock);
    for (const r of acceptedResponses) {
      const body = JSON.parse(r.body);
      expect(body.success).toBe(true);
      expect(body.status).toBe('OFFER_ACCEPTED');
      expect(body.ready_for_payment).toBe(true);
    }

    // Invariant Proof 2: Exactly 22 requests receive clean "sold out" declines
    expect(soldOutResponses).toHaveLength(concurrentBuyers - initialStock);
    for (const r of soldOutResponses) {
      const body = JSON.parse(r.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INSUFFICIENT_INVENTORY');
      expect(body.sold_out).toBe(true);
      expect(body.remaining_inventory).toBe(0);
      expect(body.error).toContain('Insufficient inventory');
    }

    // Invariant Proof 3: Zero server crashes or unhandled exceptions
    expect(crashResponses).toHaveLength(0);

    // Invariant Proof 4: Final inventory is exactly 0 and NEVER negative
    const finalStock = await inventoryService.getInventory(testSku);
    expect(finalStock).toBe(0);
  });
});
