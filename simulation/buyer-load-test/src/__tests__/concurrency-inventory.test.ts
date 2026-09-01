import { describe, it, expect } from 'vitest';
import { runConcurrentPurchaseRace } from '../concurrency-simulator.js';

describe('Concurrency-Proof Inventory Race Simulator', () => {
  it('fires 25 concurrent simulated purchase attempts at a single product seeded with stock = 3', async () => {
    const result = await runConcurrentPurchaseRace({
      concurrencyCount: 25,
      initialStock: 3,
    });

    // Invariant 1: Exactly 3 purchases succeed
    expect(result.successful_purchases).toBe(3);

    // Invariant 2: Exactly 22 requests receive a clean "sold out" response
    expect(result.clean_sold_out_declines).toBe(22);

    // Invariant 3: Zero server crashes or unhandled exceptions
    expect(result.server_crashes_count).toBe(0);

    // Invariant 4: Final inventory is exactly 0 and never negative
    expect(result.final_inventory).toBe(0);
    expect(result.negative_stock_detected).toBe(false);

    // Total accounts for 100% of requests
    expect(result.successful_purchases + result.clean_sold_out_declines).toBe(25);
  });

  it('handles custom concurrency and stock configurations deterministically', async () => {
    const result = await runConcurrentPurchaseRace({
      concurrencyCount: 30,
      initialStock: 5,
    });

    expect(result.successful_purchases).toBe(5);
    expect(result.clean_sold_out_declines).toBe(25);
    expect(result.final_inventory).toBe(0);
    expect(result.negative_stock_detected).toBe(false);
  });
});
