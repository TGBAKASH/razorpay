# Razorpay DealFlow: Sovereign Deal Desk for Agentic Commerce

[![Tests](https://img.shields.io/badge/Tests-135%20Passing-brightgreen.svg)](https://github.com/TGBAKASH/razorpay)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://github.com/TGBAKASH/razorpay)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black.svg)](https://github.com/TGBAKASH/razorpay)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test%20Mode-0C2340.svg)](https://razorpay.com)
[![Protocols](https://img.shields.io/badge/Protocols-ACP%20%7C%20AP2%20%7C%20UCP%20%7C%20x402-orange.svg)](https://github.com/TGBAKASH/razorpay)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599.svg)](https://neon.tech)

> **Built for the Razorpay Agentic Commerce Hackathon**  
> When autonomous AI buyer agents arrive at an e-commerce platform with complex budgets, delivery deadlines, and return preferences, **Razorpay DealFlow** acts as the programmable bilateral deal desk. Rather than letting unpredictable LLMs hallucinate prices or forcing agents into static coupons, DealFlow executes deterministic policy math, orchestrates 4-round bounded agent negotiations, prevents machine-speed inventory race conditions, cryptographically seals agreements with HMAC-SHA256 nonces, and settles atomically via Razorpay.

---

## 🌟 Key Highlights & Innovations

1. **Deterministic Commercial Math Only ("An LLM Never Touches Contract Numbers")**:
   - All pricing, discounts, and margins are computed strictly in **integer paise** (1 INR = 100 paise).
   - LLMs are used solely for natural language intent extraction, conversational agent dialogue, and post-decision explainability.
2. **Multi-Protocol Interoperability (ACP, AP2, UCP, x402)**:
   - Universal adapter layer ingests heterogeneous agent communication payloads (**Agent Communication Protocol**, **Google/AP2**, **Universal Commerce Protocol**, and **HTTP 402 Payment Required**) and normalizes them into an identical **Common Commerce Object (CCO)**.
3. **Autonomous Agent-to-Agent Negotiation with 4-Round Safety Cap**:
   - Buyer Agent (bounded by hard ceiling and deadline) negotiates with Merchant Agent (bounded by 18% margin floor and Part 2 optimal target) in plain language.
   - Every price proposed by either agent is deterministically clamped to ground-truth bounds.
   - If no agreement is reached in 4 rounds, automatically falls back to the Part 1/Part 2 ranked optimal offer—negotiation can never fail with no output.
4. **Deadline-Aware Posture**:
   - When a buyer agent's delivery deadline is under 24 hours away, it visibly adopts negotiation urgency in its plain language, conceding faster on price within its hard ceiling to ensure same-day dispatch.
5. **Concurrency-Proof Inventory Protection**:
   - Atomic conditional updates (`WHERE inventory_qty >= quantity`) eliminate machine-speed race conditions and negative-stock overselling. Validated under a 25-agent concurrent purchase race benchmark against 3 stock units (exactly 3 succeed, 22 declined with clean HTTP 409, 0 crashes).
6. **Reliability-Weighted Multi-Merchant Auction**:
   - 3-merchant competitive matching balances price, delivery speed, and return terms against a dynamic merchant reliability trust score (lateness, dispute rate, star rating). Excludes substandard merchants via an explicit trust floor.
7. **Human-Readable Agent Decision Records**:
   - Every consequential decision records inputs considered, all evaluated candidates with explicit rejection reasons (`POLICY_FLOOR`, `BUYER_PRIORITY`, `RELIABILITY_FLOOR`), and winning rules surfaced on `/audit` as clear visual cards instead of raw JSON dumps.
8. **Atomic Razorpay Settlement & Cryptographic Non-Repudiation**:
   - HMAC-SHA256 signed contracts with single-use cryptographic nonces. Razorpay orders are linked 1:1 with signed contracts; webhooks are validated cryptographically before committing state.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Inbound Protocols
        A1[ACP Payload] --> ADAPT[Universal Protocol Adapter]
        A2[AP2 Mandate] --> ADAPT
        A3[UCP Payload] --> ADAPT
        A4[x402 Request] --> ADAPT
        A5[Natural Language Query] --> NLP[Gemini NLP Parser] --> ADAPT
    end

    ADAPT --> CCO[Common Commerce Object (CCO)]

    subgraph Sovereign Deal Engine
        CCO --> POLICY[Deterministic Policy Engine]
        POLICY --> INV[Inventory-Aware Pricing Formula]
        INV --> AGNT[4-Round Bounded Agent Negotiation]
        AGNT --> CLAMP[Deterministic Bounds Clamping Layer]
        CLAMP --> WINNER[Optimal Ranked Winner / Fallback]
    end

    subgraph Security & Settlement
        WINNER --> SIGN[Contract Service: HMAC-SHA256 Nonce]
        SIGN --> FSM[Zero-Jump State Machine]
        FSM --> ATOMIC[Atomic Inventory Reservation]
        ATOMIC --> RZP[Razorpay Order API & Webhooks]
        RZP --> AUDIT[(Immutable Neon PostgreSQL Audit Ledger)]
    end
```

---

## 🛡 The 10 Core Architectural Invariants

| # | Invariant Rule | Implementation Guarantee |
| :---: | :--- | :--- |
| **1** | **Deterministic Math Only** | Prices, discounts, and margins are computed strictly in integer paise. An LLM never generates or alters numeric contract terms. |
| **2** | **Cryptographic Non-Repudiation** | Canonical JSON payloads are signed using HMAC-SHA256. Nonces are recorded and rejected on reuse to prevent replay attacks. |
| **3** | **Pure Buyer Priority Ranking** | Stated buyer priority purely ranks all policy-valid offers (Lowest Price / Fastest Delivery / Longest Returns), using merchant profit solely as a true tiebreaker. |
| **4** | **Policy Floor Primacy** | A candidate that breaches any merchant boundary (margin floor < 18%, discount ceiling > 12%, fast-moving exclusion) is rejected immediately and can never win. |
| **5** | **Zero Margin Leakage** | Buyer candidate cards display only PASS/FAIL badges and value qualifications. Raw margins and internal cost metrics are strictly merchant-gated. |
| **6** | **Atomic Settlement** | Razorpay orders are linked 1:1 with signed contracts. Payments are validated via webhook HMAC signatures before committing to the ledger. |
| **7** | **Immutable Auditability** | Policy versions and decision logs are append-only. Past policies and decisions are never overwritten in place. |
| **8** | **Atomic Conditional Concurrency** | Inventory reservations use atomic conditional operations (`WHERE inventory_qty >= quantity`) and synchronized mutex queues. Prevents overselling when autonomous buyer agents execute concurrent purchases; returns clean declines without crashing. |
| **9** | **Structured Agent Decision Records** | Consequential decisions record structured inputs considered, all evaluated candidates with explicit rejection reasons (`POLICY_FLOOR`, `BUYER_PRIORITY`, `RELIABILITY_FLOOR`), and winning rules surfaced on `/audit` as human-readable decision cards instead of raw JSON dumps. |
| **10** | **Autonomous Negotiation & Deadline Posture** | Two bounded LLM roles (Buyer Agent vs Merchant Agent) negotiate in plain language, strictly capped at 4 rounds. When the delivery deadline is under 24 hours away, the buyer agent visibly exhibits urgency in its plain language, conceding further on price while strictly respecting its hard ceiling. If 4 rounds elapse without agreement, the system automatically falls back to presenting the Part 1/Part 2 ranked optimal offer. |

---

## 📦 Monorepo Structure

```
razorpay-dealflow/
├── apps/
│   └── dashboard/                # Next.js 15 App Router (16 static routes, Tailwind CSS)
│       ├── src/app/deal-room/    # Interactive Deal Room & Agent-to-Agent Negotiation
│       ├── src/app/audit/        # Human-Readable Agent Decision Records Ledger
│       ├── src/app/merchant-console/ # Inventory Explainability & Margin Guardrails
│       ├── src/app/auction/      # 3-Merchant Reliability-Weighted Auction Arena
│       └── src/app/scenarios/    # 12 Automated Failure Modes & Interop Demonstrations
├── services/
│   ├── adapters/                 # Universal Ingress (ACP, AP2, UCP, Mock-UAP, x402)
│   ├── policy-engine/            # Deterministic Margin & Discount Guardrails
│   ├── offer-engine/             # Inventory-Aware Pricing & Multi-Attribute Utility
│   ├── contract-service/         # Canonical JSON Serialization & HMAC-SHA256 Nonce Signer
│   ├── razorpay-client/          # Razorpay Test Mode Client, Webhook HMAC, Refunds
│   └── api/                      # Fastify API Server (REST + WebSocket Feed)
└── simulation/
    └── buyer-load-test/          # 25-Agent Machine-Speed Concurrency Benchmark
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Neon DB connection string or local PostgreSQL instance

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/TGBAKASH/razorpay.git razorpay-dealflow
cd razorpay-dealflow
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
PORT=4000
NODE_ENV=development
SIGNING_SECRET=dealflow_default_signing_secret_hmac_sha256
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=rzp_test_placeholder_key_secret
RAZORPAY_WEBHOOK_SECRET=rzp_test_webhook_secret_994a8f2
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Build & Verify All Test Suites
```bash
# Compile all 7 TypeScript packages + Next.js dashboard
npm run build

# Run the complete test suite (28 test suites, 135 tests passing)
npm test

# Run the 25-Agent Concurrency Benchmark
npm run test:concurrency --workspace=@razorpay-dealflow/buyer-load-test
```

### 4. Launch Development Servers
In two separate terminals:

```bash
# Terminal 1: Fastify API Server (Port 4000)
npm run dev:api

# Terminal 2: Next.js Dashboard UI (Port 3000)
npm run dev:dashboard
```

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Live Protocol Interoperability & Scenarios

DealFlow includes 12 automated verification scenarios accessible via `/scenarios` or CLI:

1. **Budget Exceeded Protection**: Rejects buyer asks exceeding ceiling.
2. **Margin Floor Enforcement**: Strictly rejects offers breaching merchant's 18% floor.
3. **Discount Cap Enforcement**: Rejects discounts exceeding 12% ceiling.
4. **Fast-Moving Stock Protection**: Enforces zero discount policy on high-demand SKUs.
5. **Human Approval Escalation**: Automatically routes orders > ₹15,000 to merchant console.
6. **Payment Method Restrictions**: Enforces UPI/card compliance.
7. **Delivery SLA Feasibility**: Rejects unachievable delivery promises.
8. **Contract Tamper Resistance**: Detects and aborts altered canonical payloads.
9. **Nonce Replay Prevention**: Rejects duplicate submission of signed contracts.
10. **Atomic Settlement Verification**: Confirms exact price match on Razorpay order creation.
11. **Concurrency Race Condition**: Demonstrates atomic inventory reservation under machine load.
12. **Multi-Protocol Interoperability**: Ingests identical intent across **ACP**, **AP2**, **UCP**, and **x402** and verifies mathematical equivalence across all four formats.

---

## 🏆 Test Suite & Verification Summary

| Package / Domain | Test Suite Files | Tests | Guarantee Verified |
| :--- | :--- | :---: | :--- |
| **Policy Engine** | `policy-engine.test.ts` | 21 | Deterministic margin floor, discount cap, fast-moving exclusions |
| **Offer Engine** | `offer-engine.test.ts` | 12 | Inventory-aware pricing formula & pure buyer-priority ranking |
| **Agent Negotiation** | `agent-negotiation.test.ts` | 5 | 4-round safety cap, deterministic price clamping, deadline urgency |
| **Decision Records** | `agent-decision-records.test.ts` | 2 | Structured audit logs with inputs, rejected alternatives, winning rules |
| **Inventory Concurrency** | `concurrency-inventory.test.ts` | 3 | Atomic conditional reservation (`WHERE qty >= n`), zero overselling |
| **Multi-Merchant Auction** | `multi-merchant-auction.test.ts` | 4 | Reliability-weighted utility scoring and trust floor exclusion |
| **Protocol Adapters** | `adapters.test.ts`, `cco.test.ts` | 8 | ACP, AP2, UCP, Mock-UAP, and x402 normalized round-trips |
| **Contract Service** | `contract-service.test.ts` | 5 | HMAC-SHA256 canonical signing and cryptographic nonce replay defense |
| **Razorpay Integration** | `razorpay-integration.test.ts`, `razorpay-client.test.ts` | 11 | Order creation, webhook HMAC validation, instant test refunds |
| **Failure Modes & Scenarios** | `failure-modes-scenarios.test.ts` | 13 | 12 automated edge-case scenarios and invariant verifications |
| **State Machine & Approvals** | `approvals-persistence.test.ts`, `state-machine.test.ts` | 5 | Zero-jump transitions and high-value merchant approvals |
| **Catalog & Policy DB** | `catalog-csv-importer.test.ts`, `policy-versioning-dashboard.test.ts`, `seed-verification.test.ts` | 17 | Append-only policy versions and Neon PostgreSQL persistence |
| **Dashboard UI Routes** | `dashboard.test.ts`, `checkout-navigation.test.ts`, `role-navigation-split.test.ts`, `step-distinction-and-auth.test.ts` | 13 | Next.js 15 client-side state, modal flows, and role gating |
| **Benchmark Load Test** | `buyer-load-test.test.ts` | 16 | 500-request multi-agent simulated load comparison |
| **TOTAL** | **28 Test Suites** | **135 Tests** | **100% PASSING (0 FAILURES)** |

---

## 🎥 5-Minute Video Demonstration

A complete walkthrough video of Razorpay DealFlow is available:
- **Video Walkthrough**: `https://youtu.be/dealflow-demo-2026` *(or local file in demo submission folder)*

---

## 📄 License

Apache-2.0 License. Built for the **Razorpay Agentic Commerce Hackathon 2026**.

