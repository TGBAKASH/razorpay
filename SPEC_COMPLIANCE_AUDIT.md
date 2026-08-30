# SPEC_COMPLIANCE_AUDIT.md: Original Project Brief Reality Audit

**Audit Date**: 2026-08-29  
**Standard**: Strict codebase inspection with exact file/line evidence. Classifications: **REAL**, **PARTIAL**, **MISSING**.

---

## Executive Summary Matrix

| # | Feature / Requirement | Status | Summary Evidence |
|---|---|:---:|---|
| 1 | **Merchant Boundaries (7 Checks)** | **REAL** | All 7 rules implemented in `policy-engine/src/index.ts:80-460`. Near-expiry stock (≤30d) forces clearance eligibility. |
| 2 | **Promotion Budget** | **PARTIAL** | Schema & Seed exist in `prisma/schema.prisma:18`, but live offer generation in `offer-engine` does not read or decrement remaining budget. |
| 3 | **Refunds (API & Webhook)** | **PARTIAL** | `POST /api/orders/:id/refund` calls Razorpay and transitions to `REFUNDED` (`razorpay.ts:443`), but incoming `refund.processed` webhook handler branch is not explicitly wired. |
| 4 | **Offer Expiry** | **REAL** | `checkOfferNotExpired` + accept-time expiry transition to `EXPIRED` with audit trail (`offers.ts:500-512`, `policy-engine.ts:237-262`). No passive cron timer for idle unvisited offers. |
| 5 | **Payment Failure Recovery** | **REAL** | Failed payments switch payment rail while strictly retaining contracted price (₹3,949) with zero desperate win-back discounting (`scenarios.ts:239-320`). |
| 6 | **Inventory-Race Full Behavior** | **PARTIAL** | Live stock-out at accept-time transitions cleanly to `EXPIRED` with zero charge (`offers.ts:531-548`). Alternate proposal exists in scenario simulator (`scenarios.ts:139`), but live route returns 409 without dynamic SKU re-match. |
| 7 | **Duplicate Webhook Idempotency** | **REAL** | Deduplicated via `processedWebhookEvents` cache (`razorpay.ts:301-308`) and actively verified in test suite (`razorpay-integration.test.ts:120-167`). |
| 8 | **Protocol Adapters** | **PARTIAL** | **4 of 5** implemented & tested: ACP, UCP, AP2, mock-UAP (`adapters/src/index.ts:1-38`). `x402` adapter was never built. |
| 9 | **Measurement Harness** | **REAL** | Full 500-1,000 request simulator benchmark built in `simulation/buyer-load-test` measuring all 9 metrics comparing static baseline vs DealFlow engine (`simulator.ts:14-120`). |

---

## Detailed Compliance Audit & Evidence

### 1. Merchant Boundaries (All 7 Checks) — `REAL`
- **Minimum Margin Floor**: Enforced in [`checkMinMargin`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L80-L106) (`final_price_paise >= cost_paise * (1 + min_margin_pct/100)`).
- **Maximum Discount Ceiling**: Enforced in [`checkMaxDiscount`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L112-L145) (`discount_paise <= list_price_paise * max_discount_pct/100`).
- **Free Delivery Threshold**: Evaluated in [`checkDeliveryReachable`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L185-L225) & [`generateCandidateOffers`](file:///c:/Users/tgbak/razorpay/services/offer-engine/src/index.ts#L148).
- **No-Discount on Fast-Moving**: Enforced in [`checkFastMovingDiscountRestriction`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L329-L378).
- **Clear Products Expiring Within 30 Days**: Enforced in [`checkClearanceEligibility`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L385-L418). Specifically lines 400–411 calculate `expiryTime - now.getTime() <= clearWindowMs` and force clearance eligibility on near-expiry stock, allowing clearance discounts even on fast-moving items.
- **Prepaid Discount on High COD Risk**: Enforced in [`checkPrepaidIncentiveAllowed`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L425-L460) (grants ₹150 incentive when payment is prepaid).
- **Human Approval Above Threshold**: Enforced in [`checkHumanApprovalThreshold`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L304-L326) (flags orders over ₹15,000 for merchant review).

---

### 2. Promotion Budget — `PARTIAL`
- **Schema & Seed**: `PromotionBudget` model exists in [`prisma/schema.prisma:18-29`](file:///c:/Users/tgbak/razorpay/prisma/schema.prisma) and is seeded in [`prisma/seed.ts:50-70`](file:///c:/Users/tgbak/razorpay/prisma/seed.ts) with `allocatedPaise = 10000000`, `spentPaise = 2450000`, `remainingPaise = 7550000`.
- **Runtime Execution**: In [`services/offer-engine/src/index.ts`](file:///c:/Users/tgbak/razorpay/services/offer-engine/src/index.ts) and [`services/api/src/routes/offers.ts`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/offers.ts), candidate generation evaluates merchant policy margins and discount caps, but does **not** read or decrement the PostgreSQL `PromotionBudget` table when discounts are issued.

---

### 3. Refunds — `PARTIAL`
- **Refund API**: [`POST /api/orders/:id/refund`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/razorpay.ts#L443-L482) calls [`defaultRazorpayClient.processRefund(...)`](file:///c:/Users/tgbak/razorpay/services/razorpay-client/src/index.ts#L182-L210), transitions state machine to `REFUNDED`, and updates the order status.
- **Webhook Processing**: The webhook router [`POST /api/webhooks/razorpay`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/razorpay.ts#L278-L436) handles `payment.captured` and `payment.failed`, but does **not** explicitly branch on incoming `refund.processed` webhook events to update database records.

---

### 4. Offer Expiry — `REAL`
- **Expiry Enforcement**: [`checkOfferNotExpired`](file:///c:/Users/tgbak/razorpay/services/policy-engine/src/index.ts#L237-L262) strictly validates `expires_at > now()`.
- **State Machine Transition & Audit Trail**: In [`services/api/src/routes/offers.ts:495-512`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/offers.ts#L495-L512), when an expired offer is submitted for acceptance, it triggers `stateMachine.transition(offerId, 'EXPIRED', { action: 'OFFER_ACCEPTANCE_BREACHED_EXPIRY' })` and persists the event to PostgreSQL audit logs, returning HTTP 410 `OFFER_EXPIRED`.
- **Test Evidence**: Verified in [`services/api/src/__tests__/contract-acceptance.test.ts:70-98`](file:///c:/Users/tgbak/razorpay/services/api/src/__tests__/contract-acceptance.test.ts#L70-L98).

---

### 5. Payment Failure Recovery — `REAL`
- **Bounded Recovery Invariant**: When a gateway payment fails, the system transitions to `FAILED` and prompts alternative payment rails (e.g. Card / NetBanking) while locking the exact negotiated price (₹3,949) with **zero** desperate win-back discounts.
- **Evidence**: Implemented in [`services/api/src/routes/scenarios.ts:239-320`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/scenarios.ts#L239-L320) (Scenario 3) and rendered on the Deal Room checkout step [`deal-room/page.tsx:430-460`](file:///c:/Users/tgbak/razorpay/apps/dashboard/src/app/deal-room/page.tsx#L430-L460).

---

### 6. Inventory-Race Failure (Full Behavior) — `PARTIAL`
- **Clean Expiry Without Charge**: When stock drops before acceptance, [`services/api/src/routes/offers.ts:531-548`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/offers.ts#L531-L548) catches the shortage, transitions state to `EXPIRED`, and aborts checkout with HTTP 409 `INSUFFICIENT_INVENTORY`.
- **Alternative Offer Generation**: Scenario 1 in [`services/api/src/routes/scenarios.ts:139-160`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/scenarios.ts#L139-L160) attaches an alternative proposal object, but the live accept route `POST /api/offers/:id/accept` currently rejects with 409 rather than generating an automated alternate SKU candidate on the fly.

---

### 7. Duplicate Webhook Idempotency — `REAL`
- **Idempotency Guard**: [`services/api/src/routes/razorpay.ts:301-308`](file:///c:/Users/tgbak/razorpay/services/api/src/routes/razorpay.ts#L301-L308) tracks processed webhook event IDs in memory/DB (`processedWebhookEvents`) and immediately returns `status: 'ignored_duplicate'` on repeat deliveries.
- **Test Evidence**: Verified against the current server build in [`services/api/src/__tests__/razorpay-integration.test.ts:120-167`](file:///c:/Users/tgbak/razorpay/services/api/src/__tests__/razorpay-integration.test.ts#L120-L167).

---

### 8. Protocol Adapters (ACP, UCP, AP2, x402, mock-UAP) — `PARTIAL`
- **Implemented Adapters (4/5)**:
  - ACP (Agentic Commerce Protocol): [`services/adapters/src/acp.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/acp.ts)
  - UCP (Universal Commerce Protocol): [`services/adapters/src/ucp.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/ucp.ts)
  - AP2 (Agent Protocol v2): [`services/adapters/src/ap2.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/ap2.ts)
  - mock-UAP: [`services/adapters/src/mock-uap.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/mock-uap.ts)
- **Tested**: Verified in [`services/adapters/src/__tests__/adapters.test.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/__tests__/adapters.test.ts) and [`cco.test.ts`](file:///c:/Users/tgbak/razorpay/services/adapters/src/__tests__/cco.test.ts).
- **Missing (1/5)**: `x402` (HTTP 402 Payment Required streaming micropayment adapter) was not implemented.

---

### 9. The Measurement Harness — `REAL`
- **Package**: Fully built in [`simulation/buyer-load-test`](file:///c:/Users/tgbak/razorpay/simulation/buyer-load-test).
- **Functionality**: Generates 500–1,000 synthetic buyer requests with realistic distributions across categories, budgets, deadlines, and payment methods ([`generator.ts`](file:///c:/Users/tgbak/razorpay/simulation/buyer-load-test/src/generator.ts)). Runs dual-path simulation ([`simulator.ts`](file:///c:/Users/tgbak/razorpay/simulation/buyer-load-test/src/simulator.ts)) comparing:
  - **Path A**: Static-Price Baseline (zero personalization, fixed 5% coupon, static drop-offs).
  - **Path B**: DealFlow Autonomous Pricing Engine (policy-bounded sub-second negotiation).
- **9 Quantitative Metrics Measured**:
  1. Conversion Rate (%)
  2. Average Order Value (AOV in ₹)
  3. Gross Margin per Request (₹)
  4. Discount Cost per Converted Order (₹)
  5. Offer Acceptance Rate (%)
  6. Payment Success Rate (%)
  7. Policy Violation Count (strictly 0 in DealFlow)
  8. Human Approval Rate (%)
  9. Average Decision Latency (ms)
- **Test Evidence**: Verified with passing unit tests in [`simulation/buyer-load-test/src/__tests__/buyer-load-test.test.ts`](file:///c:/Users/tgbak/razorpay/simulation/buyer-load-test/src/__tests__/buyer-load-test.test.ts).
