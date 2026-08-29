# Razorpay DealFlow: Autonomous Agent Negotiation & Settlement Protocol

[![Tests](https://img.shields.io/badge/Tests-90%20Passing-brightgreen.svg)](file:///c:/Users/tgbak/razorpay)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](file:///c:/Users/tgbak/razorpay)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black.svg)](file:///c:/Users/tgbak/razorpay)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test%20Mode-0C2340.svg)](file:///c:/Users/tgbak/razorpay)

> **The Pitch**: When an autonomous AI buyer agent arrives at an e-commerce platform with complex budget, delivery, and payment constraints, **Razorpay DealFlow** acts as the programmable bilateral negotiation layer. Rather than letting unpredictable LLMs hallucinate prices or forcing buyers into rigid, margin-blind coupons, DealFlow runs a deterministic, zero-human policy engine to craft optimal, personalized offers within merchant margin floors and discount ceilings, cryptographically binds the agreement into an HMAC-SHA256 signed contract, orchestrates multi-merchant competitive auctions, and settles securely against Razorpay test mode with a zero-jump finite state machine and immutable audit logging.

---

## Strict Architectural Invariants

1. **Deterministic Pricing**: The LLM *NEVER* sets a price, discount, or number that reaches the contract. The LLM only parses natural language queries and writes post-decision explanations.
2. **Cryptographic Binding**: No Razorpay order is ever created for an amount that does not exactly match a valid, HMAC-SHA256 signed, unexpired, unused `OfferContract`.
3. **Paise-Integer Arithmetic**: All money math is strictly computed in integer paise (1 INR = 100 paise) with zero floating-point arithmetic.
4. **Immutable Audit Accountability**: Every state transition, policy rule evaluation, candidate scoring breakdown, and raw Razorpay API request/response is written to the audit log before the next step proceeds.
5. **Zero State Jumping**: Transitions follow a strict directed graph (`REQUEST_RECEIVED` &rarr; `OFFER_GENERATED` &rarr; `POLICY_APPROVED` &rarr; `OFFER_ACCEPTED` &rarr; `ORDER_CREATED` &rarr; `PAYMENT_ATTEMPTED` &rarr; `PAID` / `FAILED` / `EXPIRED`).

---

## Prerequisites & Installation

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 1. Clone & Install Dependencies
```bash
git clone <repo-url> razorpay-dealflow
cd razorpay-dealflow
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (or use defaults):
```env
PORT=4000
NODE_ENV=development
SIGNING_SECRET=dealflow_default_signing_secret_hmac_sha256
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=rzp_test_placeholder_key_secret
RAZORPAY_WEBHOOK_SECRET=rzp_test_webhook_secret_994a8f2
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Build & Test
```bash
# Build all workspaces (7 packages + Next.js dashboard)
npm run build

# Run the complete test suite (19 test files, 90 tests passing)
npm test

# Typecheck all TypeScript code
npm run typecheck
```

### 4. Start Local Development Servers
In two separate terminals:

```bash
# Terminal 1: Fastify API Server (Port 4000)
npm run dev:api

# Terminal 2: Next.js Dashboard UI (Port 3000)
npm run dev:dashboard
```

Open **`http://localhost:3000`** in your browser to access the dashboard.

---

## Deploying to Render + Neon

DealFlow is configured for one-click Infrastructure-as-Code deployment to **Render** with a serverless **Neon PostgreSQL** database via `render.yaml`.

> [!CAUTION]
> **Zero-Secret Commitment Invariant**:
> Secret values (API keys, database credentials, webhook secrets, HMAC keys) are **NEVER committed to git**. All secrets are configured strictly through Render's Dashboard Environment Variables or Blueprint Sync.

### Environment Variable Mapping per Service

#### 1. Backend Service (`dealflow-api`)
| Environment Variable | Description | Secret? | Example / Source |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | Neon PostgreSQL pooled connection string with SSL | **Yes** | `postgresql://user:pass@ep-pool.neon.tech/db?sslmode=require` |
| `ALLOWED_ORIGIN` | Allowed CORS origin (Dashboard frontend URL) | No | `https://dealflow-dashboard.onrender.com` |
| `RAZORPAY_KEY_ID` | Razorpay Test Key ID (never live keys) | **Yes** | `rzp_test_*` (from Razorpay Dashboard) |
| `RAZORPAY_KEY_SECRET` | Razorpay Test Key Secret | **Yes** | Entered in Render Dashboard |
| `RAZORPAY_WEBHOOK_SECRET`| Razorpay Webhook HMAC secret | **Yes** | Entered in Render Dashboard |
| `SIGNING_SECRET` | Cryptographic secret for contract signing | **Yes** | 256-bit random hex string |
| `GEMINI_API_KEY` | Google Gemini API Key for NLP parsing | **Yes** | From Google AI Studio |
| `NODE_ENV` | Runtime environment | No | `production` |

#### 2. Frontend Service (`dealflow-dashboard`)
| Environment Variable | Description | Secret? | Example / Source |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | Public URL of the deployed `dealflow-api` | No | `https://dealflow-api.onrender.com` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Test Key ID for Checkout.js modal | No | `rzp_test_*` |
| `NODE_ENV` | Runtime environment | No | `production` |

### Deploying via Render Blueprint
1. In Render, select **New +** &rarr; **Blueprint**.
2. Connect your GitHub repository. Render reads `render.yaml` and provisions both services.
3. In the Render Dashboard, fill in the required secret environment variables for `dealflow-api` and `dealflow-dashboard`.
4. Deploy will automatically run `npx prisma migrate deploy` followed by `npm start`. Health is confirmed via `GET /api/healthz`.

---

## Demo Reset Script

To reset all in-memory state machines, audit trails, active contracts, and re-seed catalog policies cleanly between demo runs:

```bash
npm run reset-demo
```

---

# Scripted Demo Walkthrough

Follow these 4 steps in order to experience the entire DealFlow protocol. No prior codebase familiarity is required.

```
Dashboard Home URL: http://localhost:3000
API Server URL:     http://localhost:4000
```

---

### Demo Step 1: Single-Merchant End-to-End Flow & Audit Trail

**Goal**: Walk through an autonomous negotiation for the **SprintPro X2 Running Shoes**, observe deterministic policy discounting, cryptographic HMAC signing, test-mode payment capture, and inspect the chronological audit log.

1. **Open Buyer Simulator**: Navigate to `http://localhost:3000/simulator`.
2. **Enter Intent**: Type or paste the following natural language request into the query box:
   > *"I need fast road running shoes under ₹4,000 in Bangalore by next Tuesday, will pay with UPI."*
   *(Alternatively, use the Quick Preset buttons to populate the constraints)*.
3. **Parse & Ingest Intent**: Click **"Parse Intent & Run Negotiation"**.
   - Gemini parses the query into a canonical Common Commerce Object (CCO).
   - The Policy Engine evaluates merchant constraints for `SPRINTPRO-X2` (List Price: ₹4,299, Cost: ₹3,350):
     - Applies **₹350 volume discount** to accelerate slow-moving inventory.
     - Final Price: **₹3,949** (`394,900` paise).
     - Margin: **17.88%** (satisfies floor margin & 12% max discount ceiling).
4. **Cryptographic Signing**: The Contract Service automatically calculates the deterministic canonical JSON representation and signs the contract with `HMAC-SHA256`. The offer displays the green **"POLICY_APPROVED & SIGNED"** badge with signature preview.
5. **Accept & Checkout**: Click **"Accept Contract & Open Checkout"**.
   - Contract verification passes (`verify(contract)` is valid).
   - Razorpay order is created for exactly `394,900` paise.
   - Click **"Pay with Razorpay (Test Mode)"** to open the modal and complete test payment.
   - Webhook delivers `payment.captured` &bull; Idempotency check verifies signature &bull; Amount is cross-checked &bull; State transitions to **`PAID`**.
6. **Inspect Audit Trail**: Click the **"View Audit Trail"** link or navigate to `http://localhost:3000/audit`.
   - Filter by your `offer_id`.
   - Review every step in chronological order: actor identity, action taken, rules evaluated, policy version (`v1`), and raw Razorpay API request/response.

---

### Demo Step 2: 3-Merchant Parallel Auction & Multi-Attribute Decision

**Goal**: Broadcast a corporate bulk intent to three competing merchant agents in parallel, review side-by-side signed bids, and test dynamic winner selection based on buyer priorities.

1. **Open Multi-Merchant Auction**: Navigate to `http://localhost:3000/auction`.
2. **Review Buyer Intent RFP**:
   > *"20 corporate gift boxes, ₹30,000 budget, Bengaluru delivery by Friday, prepaid UPI."*
3. **Broadcast Parallel RFP**: Click **"Broadcast Parallel RFP to Merchants A, B, and C"**.
   - Backend triggers parallel `Promise.all` fan-out to all 3 merchant offer engines.
   - Each merchant independently evaluates its own catalog and produces a signed HMAC contract:
     - **Merchant A (Premium Crafts)**: ₹29,500 / Thursday delivery / Free custom logo laser engraving & branding.
     - **Merchant B (Bulk Gifting Direct)**: **₹28,900** / Friday delivery / Standard packaging (*Lowest Price in Market*).
     - **Merchant C (Express Corporate Gifting)**: ₹30,000 / **Wednesday delivery** / 15-day replacement warranty (*Fastest Delivery — 2 days ahead*).
4. **Test Dynamic Priority Switching**:
   - Click **"Speed First"**: The buyer simulator utility function computes delivery speed as 50% weight &rarr; **Merchant C** wins (Utility: **0.685**) because Wednesday delivery beats Thursday and Friday. The rationale card explains the decision.
   - Click **"Price First"**: The utility function shifts weight to price &rarr; **Merchant B** wins (Utility: **0.645**) because ₹28,900 saves ₹1,100/unit under the ₹30,000 budget.
   - Click **"Extras First"**: Weight shifts to customization &rarr; **Merchant A** wins (Utility: **0.668**) for free custom laser branding.
5. **Proceed to Checkout**: Click **"Proceed to Razorpay Checkout with Winner"** on the selected winning card to commit the winning contract into Phase 6.

---

### Demo Step 3: Trigger Live Failure Modes from Demo Controls Panel

**Goal**: Prove live failure handling, security protections, and invariant enforcement.

1. **Open Demo Controls**: Navigate to `http://localhost:3000/scenarios`.
2. **Trigger Scenario 1 (Inventory Race at Accept-Time)**:
   - Click **"Trigger Scenario Live"** on Card #1.
   - *Flow*: Offer was signed for quantity 2; live warehouse inventory dropped to 1 before buyer accepted.
   - *Result*: Caught by accept-time re-check. **Zero silent fulfillment for qty 1 and zero charge**. Cleanly transitions to `EXPIRED` and generates alternative single-unit candidate proposal.
3. **Trigger Scenario 2 (Offer Tampering - Digit Flip)**:
   - Click **"Trigger Scenario Live"** on Card #2.
   - *Flow*: A compromised request body modifies `final_price_paise` from ₹3,949 to ₹2,949.
   - *Result*: `verify(tamperedContract)` detects HMAC signature mismatch. **Rejected with code `SIGNATURE_VERIFICATION_FAILED` before any Razorpay API order call**.
4. **Trigger Scenario 3 (Payment Failure & Retry)**:
   - Click **"Trigger Scenario Live"** on Card #3.
   - *Flow*: Razorpay payment failure triggered during checkout.
   - *Result*: State transitions to `FAILED`. System offers payment retry with alternative payment rails (Cards/Netbanking); **original terms (₹3,949) remain strictly unchanged with zero win-back discounts**.
5. **Batch Run (Optional)**: Click **"Trigger All 8 Scenarios Live"** at the top of the page to execute all 8 invariants (mandate budget overflow, offer expiry, logistics disruption, bad LLM prompt injection, and duplicate webhook replays) and observe 100% pass status.

---

### Demo Step 4: Synthetic Buyer Load Test & Measurement Report

**Goal**: Execute 500 synthetic buyer requests and compare DealFlow vs. Baseline.

1. **Run the Simulation CLI**:
   ```bash
   npm run simulate
   ```
   *(Or specify custom count: `npx tsx simulation/buyer-load-test/src/cli.ts 500`)*

2. **Review Output Metrics Table**:
   - **Conversion Rate**: DealFlow achieves **39.20%** vs. Baseline **34.60%** (+4.60% pts uplift).
   - **Gross Margin per Request**: DealFlow generates **₹18,076.62** vs. Baseline **₹11,685.72** (**+54.69% gross margin uplift**).
   - **Policy Violations**: DealFlow recorded **0 violations** (100% clean), while Baseline recorded **121 violations** due to margin floor breaches and discounts on fast-moving products.
   - **Mathematical Consistency**: Conversions strictly match the count of `PAID` state contracts (`196/500 = 39.20%`), and gross profit exactly equals revenue minus cost.
3. **View Report File**: The complete Markdown report with ASCII visual charts is saved at [`REPORT.md`](file:///c:/Users/tgbak/razorpay/REPORT.md).

---

## Monorepo Package Architecture

```
razorpay-dealflow/
├── apps/
│   └── dashboard/          # Next.js 15 Tailwind Dashboard UI (13 static screens)
├── services/
│   ├── adapters/           # Protocol Mappers (ACP, UCP, AP2, Mock-UAP) -> CCO
│   ├── api/                # Fastify Backend API, State Machine, Audit Engine
│   ├── contract-service/   # HMAC-SHA256 Canonical JSON Signing & Nonce Store
│   ├── offer-engine/       # Heuristic Scoring, Candidate Generation & Explanations
│   ├── policy-engine/      # Pure Deterministic Business Rule Evaluator (10 Rules)
│   └── razorpay-client/    # Razorpay Test Mode Client & Webhook Verifier
├── simulation/
│   └── buyer-load-test/    # 500-1000 Synthetic Multi-Agent Load Benchmark
└── prisma/                 # SQLite Schema, Seed Scripts & Migrations
```

---

## Verification Summary

| Test Suite | Files | Tests | Status |
| :--- | :--- | :--- | :--- |
| Policy Engine Boundary Rules | `policy-engine.test.ts` | 21 | **PASSED** |
| HMAC Contract Signing & Nonce Store | `contract-service.test.ts`, `contract-acceptance.test.ts` | 10 | **PASSED** |
| Offer Engine & Heuristic Ranking | `offer-engine.test.ts` | 3 | **PASSED** |
| State Machine & Audit Timeline | `state-machine.test.ts` | 3 | **PASSED** |
| Razorpay Webhooks & Test Refunds | `razorpay-integration.test.ts`, `razorpay-client.test.ts` | 10 | **PASSED** |
| Multi-Merchant Auction Engine | `multi-merchant-auction.test.ts` | 4 | **PASSED** |
| Protocol Adapters (ACP/UCP/AP2/UAP)| `adapters.test.ts`, `adapter-e2e.test.ts` | 7 | **PASSED** |
| Failure Modes & Invariant Controls | `failure-modes-scenarios.test.ts` | 9 | **PASSED** |
| Buyer Load Test & Simulation | `buyer-load-test.test.ts` | 3 | **PASSED** |
| CSV Importer & Policy Versioning | `catalog-csv-importer.test.ts`, `policy-versioning-dashboard.test.ts` | 9 | **PASSED** |
| Dashboard & Seed Verifiers | `dashboard.test.ts`, `seed-verification.test.ts`, `cco.test.ts` | 11 | **PASSED** |
| **TOTAL** | **19 Suites** | **90 Tests** | **100% PASSED** |
