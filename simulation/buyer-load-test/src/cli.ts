import fs from 'node:fs';
import path from 'node:path';
import { runSimulationBenchmark } from './simulator.js';
import { generateMarkdownReport } from './reporter.js';

async function main() {
  const args = process.argv.slice(2);
  const count = args[0] ? parseInt(args[0], 10) : 500;

  console.log(`\n======================================================`);
  console.log(` Running DealFlow vs. Baseline Load Simulation (${count} requests)...`);
  console.log(`======================================================\n`);

  const startTime = Date.now();
  const result = runSimulationBenchmark(count);
  const durationMs = Date.now() - startTime;

  const markdownReport = generateMarkdownReport(result);

  // Write to REPORT.md in workspace
  const reportPath = path.resolve(process.cwd(), 'REPORT.md');
  fs.writeFileSync(reportPath, markdownReport, 'utf-8');

  // Print summary to console
  console.log(markdownReport);
  console.log(`\n[✓] Simulation completed in ${durationMs} ms`);
  console.log(`[✓] Full Markdown Report written to: ${reportPath}\n`);
}

main().catch((err) => {
  console.error('Simulation execution failed:', err);
  process.exit(1);
});
