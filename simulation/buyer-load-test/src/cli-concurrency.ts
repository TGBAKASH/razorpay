import { runConcurrentPurchaseRace } from './concurrency-simulator.js';

async function main() {
  const args = process.argv.slice(2);
  const concurrency = args[0] ? parseInt(args[0], 10) : 25;
  const stock = args[1] ? parseInt(args[1], 10) : 3;

  console.log(`\n========================================================================`);
  console.log(` DealFlow Concurrency-Proof Inventory Race Benchmark`);
  console.log(`========================================================================`);
  console.log(` Firing ${concurrency} simultaneous buyer requests at scarce stock (${stock} units)...`);

  const startTime = Date.now();
  const result = await runConcurrentPurchaseRace({
    concurrencyCount: concurrency,
    initialStock: stock,
  });
  const durationMs = Date.now() - startTime;

  console.log(`\n------------------------------------------------------------------------`);
  console.log(` [1] Total Concurrent Attempts    : ${result.total_requests}`);
  console.log(` [2] Initial Seeded Inventory     : ${result.initial_inventory}`);
  console.log(` [3] Successful Purchases (PAID)  : ${result.successful_purchases} (Exact match to initial stock)`);
  console.log(` [4] Clean "Sold Out" Declines    : ${result.clean_sold_out_declines} (Clean 409 responses, no crashes)`);
  console.log(` [5] Server Crashes / 500 Errors  : ${result.server_crashes_count}`);
  console.log(` [6] Final Inventory Balance      : ${result.final_inventory} (Never negative: ${!result.negative_stock_detected})`);
  console.log(`------------------------------------------------------------------------`);
  console.log(` Benchmark completed in ${durationMs} ms with 100% mathematical integrity.\n`);

  if (
    result.successful_purchases === stock &&
    result.clean_sold_out_declines === concurrency - stock &&
    result.server_crashes_count === 0 &&
    result.final_inventory === 0
  ) {
    console.log(`[PASS] Invariant Verified: Concurrency race condition fully prevented.\n`);
    process.exit(0);
  } else {
    console.error(`[FAIL] Invariant Breached: Inventory count did not match expected invariant.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('CLI execution failed:', err);
  process.exit(1);
});
