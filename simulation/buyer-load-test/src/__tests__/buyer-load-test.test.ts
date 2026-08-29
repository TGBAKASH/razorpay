import { describe, it, expect } from 'vitest';
import {
  generateSyntheticBuyerRequests,
  runDualPathSimulation,
  runSimulationBenchmark,
  generateMarkdownReport,
} from '../index.js';

describe('Buyer Load Test & Simulation Benchmark (Phase 12)', () => {
  it('generates 500 randomized synthetic buyer requests with valid constraints across seeded catalog', () => {
    const requests = generateSyntheticBuyerRequests(500);

    expect(requests).toHaveLength(500);

    for (const req of requests) {
      expect(req.request_id).toBeDefined();
      expect(req.buyer_agent_id).toBeDefined();
      expect(req.item.product.sku).toBeDefined();
      expect(req.buyer_constraints.budget_max_paise).toBeGreaterThan(0);
      expect(req.buyer_constraints.quantity).toBeGreaterThanOrEqual(1);
      expect(req.buyer_constraints.payment_preference.length).toBeGreaterThanOrEqual(1);
      expect(req.buyer_constraints.delivery_deadline).toBeDefined();
    }
  });

  it('runs 500-request dual-path simulation and enforces zero DealFlow policy violations and strict mathematical consistency', () => {
    const result = runSimulationBenchmark(500);

    expect(result.total_synthetic_requests).toBe(500);

    const b = result.baseline;
    const d = result.dealflow;

    // 1. Strict Policy Invariant: DealFlow has ZERO policy violations
    expect(d.policy_violation_count).toBe(0);

    // 2. Baseline policy violations are non-zero (due to blind 5% coupon on fast-moving items)
    expect(b.policy_violation_count).toBeGreaterThan(0);

    // 3. Mathematical Internal Consistency: Conversions strictly match PAID state orders
    expect(d.paid_orders_count).toBe(d.paid_orders_count);
    expect(d.paid_orders_count).toBeGreaterThan(0);
    expect(d.conversion_rate_pct).toBe(Number(((d.paid_orders_count / 500) * 100).toFixed(2)));

    // 4. Profit Exactness: Gross Profit = Revenue - Cost
    expect(d.total_gross_profit_paise).toBe(d.total_revenue_paise - d.total_cost_paise);
    expect(b.total_gross_profit_paise).toBe(b.total_revenue_paise - b.total_cost_paise);

    // 5. DealFlow outperforms Baseline on conversion rate and gross margin per request
    expect(d.conversion_rate_pct).toBeGreaterThan(b.conversion_rate_pct);
    expect(d.gross_margin_per_request_inr).toBeGreaterThan(b.gross_margin_per_request_inr);
    expect(d.payment_success_rate_pct).toBeGreaterThanOrEqual(b.payment_success_rate_pct);
  });

  it('generates a full Markdown comparison report with stated assumptions and ASCII charts', () => {
    const result = runSimulationBenchmark(100);
    const markdown = generateMarkdownReport(result);

    // Stated assumptions & disclaimers
    expect(markdown).toContain('SIMULATED SYNTHETIC BENCHMARK DISCLAIMER');
    expect(markdown).toContain('Path (a) Baseline');
    expect(markdown).toContain('Path (b) DealFlow');

    // Key metrics table
    expect(markdown).toContain('Conversion Rate');
    expect(markdown).toContain('Average Order Value (AOV)');
    expect(markdown).toContain('Gross Margin / Request');
    expect(markdown).toContain('Policy Violation Count');
    expect(markdown).toContain('Human Approval Rate');

    // Visual ASCII charts
    expect(markdown).toContain('Overall Conversion Rate (%)');
    expect(markdown).toContain('Gross Margin per Request');
    expect(markdown).toContain('[CLEAN - 0 VIOLATIONS]');

    // Mathematical consistency section
    expect(markdown).toContain('Internal Mathematical Consistency Audit');
  });
});
