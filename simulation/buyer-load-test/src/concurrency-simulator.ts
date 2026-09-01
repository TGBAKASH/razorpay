import { sign } from '@razorpay-dealflow/contract-service';
import { generateCandidateOffers, scoreCandidateOffer } from '@razorpay-dealflow/offer-engine';
import { evaluateAllPolicies } from '@razorpay-dealflow/policy-engine';
import { SIMULATION_CATALOG } from './generator.js';

export interface ConcurrencyRaceResult {
  total_requests: number;
  initial_inventory: number;
  successful_purchases: number;
  clean_sold_out_declines: number;
  server_crashes_count: number;
  final_inventory: number;
  negative_stock_detected: boolean;
  request_logs: Array<{
    buyer_id: string;
    status: 'OFFER_ACCEPTED' | 'OUT_OF_STOCK' | 'CRASHED';
    message: string;
    remaining_stock_at_decision: number;
    latency_ms: number;
  }>;
}

/**
 * Concurrency-Proof Inventory Race Simulator
 *
 * Simulates machine-speed autonomous agents competing simultaneously
 * for scarce inventory (e.g. 25 requests for 3 units).
 * Uses atomic conditional updates to guarantee zero overselling.
 */
export async function runConcurrentPurchaseRace(options: {
  concurrencyCount?: number;
  initialStock?: number;
  sku?: string;
} = {}): Promise<ConcurrencyRaceResult> {
  const concurrencyCount = options.concurrencyCount ?? 25;
  const initialStock = options.initialStock ?? 3;
  const sku = options.sku ?? 'SPRINTPRO-X2';

  // Find product in simulation catalog
  const catalogEntry = SIMULATION_CATALOG.find((c) => c.product.sku === sku) || SIMULATION_CATALOG[0]!;
  const product = { ...catalogEntry.product };
  const policy = { ...catalogEntry.policy };

  // Shared atomic inventory state with serialization lock
  let currentInventory = initialStock;
  let lockPromise = Promise.resolve();

  const acquireLock = async <T>(fn: () => Promise<T> | T): Promise<T> => {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = lockPromise;
    lockPromise = (async () => {
      await current;
      await nextLock;
    })();

    await current;
    try {
      return await fn();
    } finally {
      release!();
    }
  };

  const atomicReserve = async (quantity: number): Promise<{ success: boolean; remaining: number }> => {
    return acquireLock(async () => {
      // Simulate real-world microtask delay inside database transaction
      await new Promise((r) => setTimeout(r, Math.random() * 5));

      // Atomic conditional check: WHERE inventory_qty >= quantity
      if (currentInventory >= quantity) {
        currentInventory -= quantity;
        return { success: true, remaining: currentInventory };
      } else {
        return { success: false, remaining: currentInventory };
      }
    });
  };

  const now = new Date();

  // Create 25 buyer requests
  const buyerTasks = Array.from({ length: concurrencyCount }, async (_, idx) => {
    const buyerId = `buyer-agent-race-${String(idx + 1).padStart(2, '0')}`;
    const start = performance.now();

    try {
      const buyerConstraints = {
        budget_max_paise: 400000,
        currency: 'INR' as const,
        delivery_deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 1,
        payment_preference: ['upi'] as ('upi' | 'card' | 'netbanking' | 'cod')[],
        return_preference: 'easy returns',
        priorities: ['price', 'delivery_speed'] as ('price' | 'delivery_speed' | 'return_terms' | 'extras')[],
      };

      // 1. Generate & Score Candidate Offer
      const candidates = generateCandidateOffers(
        buyerConstraints,
        product,
        policy,
        { sku, available_qty: initialStock, warehouse_location: 'BLR-WH-01', carrier_sla_days: { 'BLR-WH-01': 2 } },
        now
      );

      const validCandidates = candidates.filter((c) => evaluateAllPolicies(c, policy, product, { sku, available_qty: initialStock, warehouse_location: 'BLR-WH-01' }, now).pass);
      const scored = validCandidates.map((c) => scoreCandidateOffer(c, evaluateAllPolicies(c, policy, product, { sku, available_qty: initialStock, warehouse_location: 'BLR-WH-01' }, now), product, buyerConstraints));
      scored.sort((a, b) => a.candidate.final_price_paise - b.candidate.final_price_paise);
      const winning = scored[0]!;

      // 2. Cryptographic contract signing
      sign({
        offer_id: `off-race-${idx + 1}`,
        buyer_agent_id: buyerId,
        merchant_id: 'merchant-sprint',
        sku,
        quantity: 1,
        final_price_paise: winning.candidate.final_price_paise,
        currency: 'INR',
        payment_methods_allowed: winning.candidate.payment_methods_allowed,
        delivery_promise: winning.candidate.delivery_promise,
        return_terms_days: winning.candidate.return_terms_days,
        expires_at: winning.candidate.expires_at,
        policy_version: policy.policy_version,
      });

      // 3. Concurrent Accept Attempt with Atomic Conditional Reservation
      const reservation = await atomicReserve(1);
      const latency = Number((performance.now() - start).toFixed(2));

      if (reservation.success) {
        return {
          buyer_id: buyerId,
          status: 'OFFER_ACCEPTED' as const,
          message: `Purchased unit at ₹${(winning.candidate.final_price_paise / 100).toFixed(2)} (Stock remaining: ${reservation.remaining})`,
          remaining_stock_at_decision: reservation.remaining,
          latency_ms: latency,
        };
      } else {
        return {
          buyer_id: buyerId,
          status: 'OUT_OF_STOCK' as const,
          message: `Clean decline: Item is sold out (Stock remaining: ${reservation.remaining})`,
          remaining_stock_at_decision: reservation.remaining,
          latency_ms: latency,
        };
      }
    } catch (err: any) {
      return {
        buyer_id: buyerId,
        status: 'CRASHED' as const,
        message: `Unhandled exception: ${err.message}`,
        remaining_stock_at_decision: currentInventory,
        latency_ms: Number((performance.now() - start).toFixed(2)),
      };
    }
  });

  // Fire all buyer purchase tasks simultaneously at the exact same tick
  const results = await Promise.all(buyerTasks);

  const successfulPurchases = results.filter((r) => r.status === 'OFFER_ACCEPTED').length;
  const cleanSoldOutDeclines = results.filter((r) => r.status === 'OUT_OF_STOCK').length;
  const serverCrashes = results.filter((r) => r.status === 'CRASHED').length;

  return {
    total_requests: concurrencyCount,
    initial_inventory: initialStock,
    successful_purchases: successfulPurchases,
    clean_sold_out_declines: cleanSoldOutDeclines,
    server_crashes_count: serverCrashes,
    final_inventory: currentInventory,
    negative_stock_detected: currentInventory < 0,
    request_logs: results,
  };
}
