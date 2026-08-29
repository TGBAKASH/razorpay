import { stateMachine } from '../services/state-machine.js';
import { nonceStore } from '@razorpay-dealflow/contract-service';
import { processedWebhookEvents } from '../routes/razorpay.js';
import { activeContracts } from '../routes/offers.js';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';

export async function resetDemoEnvironment() {
  console.log('\n======================================================');
  console.log(' Resetting Razorpay DealFlow Demo State & Cache...');
  console.log('======================================================\n');

  // 1. Reset State Machine and timeline
  stateMachine.reset();
  console.log(' [✓] In-memory State Machine & Audit Timeline cleared');

  // 2. Reset Nonce Replay Store
  nonceStore.reset();
  console.log(' [✓] Cryptographic Nonce Replay Store reset');

  // 3. Reset Processed Webhook Event ID Set
  processedWebhookEvents.clear();
  console.log(' [✓] Razorpay Webhook Idempotency Event Registry cleared');

  // 4. Reset Active Signed Offer Contracts
  activeContracts.clear();
  console.log(' [✓] Active Signed Offer Contracts cleared');

  // 5. Restore Default Catalog Policies
  const sprintMerchant = CATALOG_MERCHANTS[0]!;
  sprintMerchant.policy = {
    policyVersion: 'v1',
    minMarginPct: 18.0,
    maxDiscountPct: 12.0,
    freeDeliveryAbovePaise: 149900,
    noDiscountFastMoving: true,
    clearWithinDays: 30,
    prepaidDiscountOnHighCodRisk: true,
    humanApprovalAbovePaise: 1500000,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system:reset',
  };
  console.log(` [✓] Merchant policies reset to baseline v1 (${sprintMerchant.policy.policyVersion})`);

  console.log('\n[✓] DealFlow demo environment cleanly reset and ready for demonstration.\n');
}

if (process.env.NODE_ENV !== 'test') {
  resetDemoEnvironment().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
}
