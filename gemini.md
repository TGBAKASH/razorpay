# Razorpay DealFlow — Master Build Prompt for Google Antigravity

**The negotiation layer for agentic commerce.** A merchant-side AI agent that negotiates profitable, bounded offers with buyer agents, signs them into verifiable contracts, and settles them through Razorpay — with a full audit trail and graceful failure handling.

This document is written to be used *inside* Google Antigravity. It's structured in two parts:

1. **The Blueprint** — paste this into `GEMINI.md` at the root of your project. Antigravity's agents read this automatically for every task, so it keeps context (naming, invariants, non-negotiables) consistent across all phases instead of you re-explaining it each time.
2. **The Phases** — 14 scoped prompts (Phase 0–13). Run them **in order**, one at a time, in the Agent Panel. Use **Planning Mode** for each phase first (let the agent produce a plan artifact before it writes code), review the plan, then let it execute. For independent phases (e.g. Phase 9 auction sim + Phase 12 measurement harness) you can dispatch separate agents in parallel via the Agent Manager once their dependencies are done.

Don't paste all 14 phases in one message — that's how steps get silently dropped. One phase, one agent run, one verification, then move on.

---

## PART 1 — THE BLUEPRINT (save as `GEMINI.md`)

```markdown
# Project: Razorpay DealFlow

## What this is
An agentic commerce backend. A "buyer agent" (an AI shopping on behalf of a customer)
sends structured intent. DealFlow finds qualifying products from a merchant's live
inventory, computes a profitable bounded offer, signs it into a verifiable contract,
and — only after the buyer accepts and the contract re-verifies — creates a Razorpay
order and takes payment in test mode.

## Non-negotiable invariants (apply to every phase, no exceptions)
1. The LLM NEVER sets a price, discount, or any number that reaches the contract.
   The LLM's only jobs are: (a) parsing ambiguous natural-language buyer intent into
   the validated schema, and (b) writing the human-readable explanation of a decision
   the deterministic engine already made. If the LLM's output contains a number that
   would change the offer, discard it and re-derive the number from the policy engine.
2. No Razorpay order is ever created for an amount that doesn't exactly match a
   currently-valid, signed, unexpired, unused offer contract. This check happens in
   code, synchronously, immediately before the Razorpay Orders API call — not as a
   later audit step.
3. Every state transition, policy check, discount reason, and Razorpay API
   call/response is written to the audit log before the next step proceeds.
4. Failures never invent a workaround. If inventory drops, if a payment fails, if a
   webhook looks tampered — the system stops, logs why, and either offers a bounded
   recovery option (alternate SKU within the original mandate, alternate payment
   method) or expires the offer without charging anyone. It never silently
   substitutes a product or a price.
5. All money math is done in integer paise, never floats.
6. Everything runs against Razorpay **test mode** keys. Never wire in live keys.

## Tech stack
- Backend: Node.js + TypeScript, Fastify (or Express), Zod for schema validation
- DB: PostgreSQL via Prisma
- Frontend: Next.js + Tailwind (merchant dashboard, buyer-agent simulator, audit UI)
- LLM: Gemini API (intent parsing + explanation generation only — see invariant 1)
- Payments: Razorpay Node SDK, Razorpay Checkout.js, Razorpay Webhooks
- Signing: Node `crypto` module — HMAC-SHA256 for MVP, Ed25519 keypair as stretch goal
- Testing: Vitest/Jest for the policy engine and contract signer specifically —
  these two modules need boundary-condition unit tests, not just happy-path checks

## Repo structure (create this early, keep it stable across phases)
/apps
  /dashboard        -> Next.js merchant dashboard + buyer simulator + audit UI
/services
  /api               -> Fastify backend: intent, offers, policy, contracts, orders, webhooks
  /policy-engine     -> pure functions, no side effects, fully unit tested
  /contract-service  -> signing + verification of offer contracts
  /offer-engine      -> rules + LLM interpretation + ranking/optimization
  /razorpay-client   -> thin wrapper over Razorpay SDK (orders, webhooks, refunds)
  /adapters          -> ACP / UCP / AP2 / mock-UAP -> Common Commerce Object mappers
/simulation
  /buyer-load-test   -> generates 500-1000 synthetic buyer requests, scores baseline vs engine
/prisma              -> schema.prisma + seed data (catalog CSV, merchant policy)

## Definition of done for the whole project
A judge can: upload a catalog CSV, set merchant policy in the dashboard, trigger a
buyer-agent request (single-merchant and 3-merchant auction versions), watch an offer
get generated with a plain-English reason, accept it, pay via Razorpay test-mode
checkout, see the webhook land, see the audit trail explain every step, and then
trigger at least 3 of the 8 documented failure scenarios and see them handled
gracefully instead of crashing or silently compensating.
```

---

## PART 2 — THE COMMON COMMERCE OBJECT

Every adapter (ACP, UCP, AP2, mock-UAP, or the buyer-agent simulator itself) normalizes into this one object. The Deal Engine only ever speaks this schema — it doesn't know or care which protocol the buyer arrived from.

```json
{
  "intent": {
    "id": "uuid",
    "buyer_agent_id": "string",
    "protocol_source": "ACP | UCP | AP2 | mock-UAP | simulator",
    "category": "string",
    "raw_query": "string (original NL query, if any)",
    "created_at": "ISO8601"
  },
  "buyer_constraints": {
    "budget_max_paise": "integer",
    "currency": "INR",
    "delivery_deadline": "ISO8601 date",
    "quantity": "integer",
    "payment_preference": ["upi", "card", "netbanking", "cod"],
    "return_preference": "string",
    "priorities": ["price", "delivery_speed", "return_terms", "extras"]
  },
  "cart": {
    "items": [
      { "sku": "string", "qty": "integer", "list_price_paise": "integer" }
    ]
  },
  "offer": {
    "offer_id": "uuid",
    "sku": "string",
    "quantity": "integer",
    "final_price_paise": "integer",
    "discount_paise": "integer",
    "discount_reason": ["string"],
    "delivery_promise": "ISO8601 date",
    "return_terms_days": "integer",
    "payment_methods_allowed": ["string"],
    "expires_at": "ISO8601 timestamp",
    "policy_version": "string"
  },
  "authorization": {
    "signature": "string",
    "signing_key_id": "string",
    "nonce": "string",
    "signed_at": "ISO8601"
  },
  "payment": {
    "razorpay_order_id": "string|null",
    "razorpay_payment_id": "string|null",
    "status": "PENDING|PAID|FAILED|REFUNDED",
    "amount_paise": "integer",
    "method": "string|null"
  },
  "fulfillment": {
    "state": "string (see state machine)",
    "events": [{ "at": "ISO8601", "event": "string", "detail": "object" }]
  }
}
```

---

## PART 3 — SIGNED OFFER CONTRACT (hardened, GhostRail-style)

This is the piece that stops an agent — buyer-side, merchant-side, or a compromised client — from ever changing an amount after it's been negotiated. Build this as its own service (`/services/contract-service`) with two functions and nothing else: `sign(offer)` and `verify(signedOffer)`.

**Fields signed (canonical JSON, stable key order, no floats):**
`offer_id, buyer_agent_id, merchant_id, sku, quantity, final_price_paise, currency, payment_methods_allowed, delivery_promise, return_terms_days, expires_at, policy_version, nonce`

**Flow — the ordering is the whole point:**
1. Offer Engine computes a candidate offer.
2. Policy Engine validates every hard constraint (Part 4). If any fail, no contract is signed — full stop.
3. The moment it passes, Contract Service signs the canonical payload with a server-held key. This happens server-side, synchronously, before the offer is ever shown to the buyer agent. The buyer agent receives the full signed contract, not just a price.
4. Buyer accepts → sends the **exact signed contract** back (not just an offer_id).
5. Server re-verifies: signature valid, not expired, nonce not already consumed, and re-runs the live checks (inventory still > 0, price still matches current catalog state). **Only if all of this passes** does the server call the Razorpay Orders API, and it uses `final_price_paise` from the verified contract as the order amount — never a value passed in the request body.
6. The `razorpay_order_id` returned is stored 1:1 against `offer_id`. Nothing else may ever reuse that offer_id.
7. When the payment webhook lands, re-verify the Razorpay webhook signature (Razorpay's HMAC secret) **and separately** check `webhook.payload.amount == contract.final_price_paise` and `webhook.payload.order_id == stored razorpay_order_id`. Any mismatch marks the order `FLAGGED`, not `PAID`, and writes a high-priority audit entry — it does not fail open.
8. Nonce is marked consumed the moment an order is created from it, so the same signed contract can never be replayed into a second order.

**MVP signing:** HMAC-SHA256 with a server secret (fast to build, sufficient to demo). **Stretch goal:** Ed25519 keypair per merchant, so a buyer agent can verify a contract's authenticity offline using the merchant's public key without a callback — this is the same verifiable-authorization idea AP2 is built around, just scoped to something you can actually ship in the time you have.

**The line for your pitch deck:** *"Agents never hold payment credentials or unsigned price authority. Every rupee that reaches Razorpay is bound to a signed, expiring, single-use contract that the deterministic policy engine approved before any model touched it — and the signature is verified again, independently, before the money moves."*

---

## PART 4 — DETERMINISTIC POLICY ENGINE (pure functions, no LLM inside)

Every check below must exist as an independently unit-tested function in `/services/policy-engine`, with tests for the exact boundary (e.g. margin at exactly 18.0%, discount at exactly the ceiling, offer expiring at t=0).

```
final_price_paise  >= cost_paise + (cost_paise * min_margin_pct)
discount_paise     <= list_price_paise * max_discount_pct
inventory_qty      >  0  (checked twice: at offer generation, and again at accept-time)
delivery_promise   is reachable given warehouse + carrier SLA data
offer.expires_at   >  now()  (checked at every step, not just once)
payment.amount     == contract.final_price_paise  (exact, integer, no tolerance)
order_total_paise  <= human_approval_threshold_paise, else route to APPROVAL_PENDING
sku.clearance_flag => allow discount even if otherwise "do not discount fast-moving"
sku.expires_within_30d => force clearance-eligible regardless of movement rate
cod_return_risk == high AND payment_preference includes prepaid
                   => allow prepaid-incentive discount from promo budget, not margin
```

Merchant policy config (seeded from the dashboard) should look like:

```json
{
  "policy_version": "v1",
  "min_margin_pct": 18,
  "max_discount_pct": 12,
  "free_delivery_above_paise": 149900,
  "no_discount_fast_moving": true,
  "clear_within_days": 30,
  "prepaid_discount_on_high_cod_risk": true,
  "human_approval_above_paise": 1500000
}
```

---

## PART 5 — THE PHASES

Run these in order. Each block is meant to be pasted as-is into Antigravity's Agent Panel.

### Phase 0 — Scaffold
```
Set up the monorepo exactly as described in GEMINI.md under "Repo structure".
Initialize Next.js (apps/dashboard), Fastify+TypeScript (services/api), and Prisma
with a Postgres connection. Add empty package folders for policy-engine,
contract-service, offer-engine, razorpay-client, and adapters with their own
package.json and a placeholder index.ts + test file each. Add a root README that
restates the non-negotiable invariants from GEMINI.md. Do not implement any business
logic yet — this phase is scaffolding and CI wiring (lint + test script) only.
Verify: `npm run build` and `npm test` succeed with placeholder passing tests in
every package.
```

### Phase 1 — Data model & merchant policy
```
Design the Prisma schema for: Merchant, MerchantPolicy (versioned — never mutate a
policy in place, always insert a new version so old signed offers stay auditable
against the version that approved them), Product/Catalog (sku, cost_paise,
list_price_paise, inventory_qty, movement_rate: fast|normal|slow, expiry_date,
warehouse_location), PromotionBudget, Offer, OfferContract (the signed payload +
signature + nonce + consumed_at), RazorpayOrder, PaymentEvent, AuditLogEntry
(actor, action, input_data, policy_checked, policy_version, result, reason,
timestamp). Build a CSV importer for the catalog (accept the columns implied above,
validate with Zod, reject rows with negative margin at list price with a clear
error). Seed the DB with the SprintPro X2 example from the brief (cost ₹2,650, list
₹4,299, 41 units, slow-moving) and the 3-merchant gift-box auction example data.
Verify: seed script runs clean, and a query for the SprintPro X2 SKU returns the
exact seeded values.
```

### Phase 2 — Common Commerce Object + buyer-agent simulator
```
Implement the Common Commerce Object TypeScript types exactly as specified in
GEMINI.md Part 2. Build the buyer-agent simulator as a page in apps/dashboard where
a user picks: category, budget, delivery deadline, quantity, payment preference,
return preference, and priority ranking (drag to reorder: price / delivery speed /
return terms / extras). Also add a free-text box — natural language goes through a
/api/intent/parse endpoint that calls Gemini to extract the same fields, but the
result must be re-validated against the same Zod schema as the structured form
before it's accepted. If Gemini's extraction is missing a required field, the UI
asks for it directly rather than guessing. On submit, POST a fully-formed Common
Commerce Object to /api/intent.
Verify: submitting the free-text example from the brief ("running shoes under
₹4,000, delivered by Tuesday, easy returns, UPI") produces the same validated
object as filling the structured form manually.
```

### Phase 3 — Deterministic Policy Engine
```
Implement every check listed in GEMINI.md Part 4 as a pure function in
services/policy-engine, each taking (offer_candidate, merchant_policy, product,
inventory_snapshot, now) and returning {pass: boolean, reason: string,
checked_rule: string}. No function may call the network, the DB, or the LLM. Write
unit tests for every rule at its exact boundary value, not just clearly-pass and
clearly-fail cases. Also implement the approval-threshold routing: if
final_price_paise * quantity > human_approval_above_paise, the offer's status must
become APPROVAL_PENDING instead of POLICY_APPROVED, and it must not be signable
until a human approves it via a dashboard action.
Verify: run the test suite and show at least one test that fails a proposed 20%
discount because it exceeds a 12% ceiling, and one that fails a proposed price
because margin lands at 17.9% instead of the required 18%.
```

### Phase 4 — Offer Engine (rules + Gemini + ranking)
```
Build services/offer-engine. Given a validated Common Commerce Object and the
qualifying products from catalog, generate 1-3 candidate offers using: applicable
merchant rules (clearance, expiring stock, promo budget, prepaid-on-high-COD-risk),
then run each candidate through the Phase 3 policy engine, discard anything that
fails, then score the surviving candidates by an expected-profit heuristic
(discount cost vs. estimated conversion lift vs. return-cost avoidance from prepaid)
— implement this as an explicit weighted formula for now, with a comment marking it
as the place a contextual-bandit model would later replace hard-coded weights.
Select the highest-scoring valid candidate. Call Gemini ONLY to turn the winning
candidate's already-decided numbers and discount_reason array into a one-paragraph
plain-English explanation — the prompt to Gemini must include an explicit
instruction not to alter or suggest different numbers, and the code must ignore any
numeric values Gemini's response contains.
Verify: run the SprintPro X2 example end to end and confirm the output matches the
brief's Offer A (₹3,949, prepaid UPI, Monday delivery, 10-day returns, 8-minute
expiry, 20.4% margin) with a generated explanation citing the same four reasons.
```

### Phase 5 — Signed Offer Contract Service
```
Implement services/contract-service exactly per GEMINI.md Part 3: sign() and
verify(). Canonical JSON serialization must be deterministic (sorted keys, no
whitespace variance) so the signature is reproducible. Wire it into the flow so
that the moment Phase 3's policy check passes, sign() is called automatically and
the OfferContract row is written with status POLICY_APPROVED — the buyer never sees
an offer that hasn't already been signed. Add POST /api/offers/:id/accept which
requires the full signed contract in the request body (not just an ID), and inside
it: verify() the signature, check expiry, check the nonce hasn't been consumed,
re-check live inventory and price against catalog, and only then mark the contract
consumed and proceed to Phase 6. If any check fails, respond with a specific
rejection reason and write an audit entry — never silently re-price or substitute.
Verify: write a test that takes a validly signed contract, flips one digit of
final_price_paise, and confirms verify() rejects it before any Razorpay call is
even attempted. Write a second test proving a consumed nonce cannot be replayed.
```

### Phase 6 — Razorpay integration (test mode)
```
Implement services/razorpay-client as a thin wrapper: createOrder(contract) — takes
a verified OfferContract, creates a Razorpay order with amount =
contract.final_price_paise, currency INR, and stores the razorpay_order_id 1:1
against offer_id. Build the checkout page in apps/dashboard using Razorpay
Checkout.js in test mode, keyed off that order. Implement POST
/api/webhooks/razorpay: verify the Razorpay webhook signature using the raw request
body and the webhook secret before parsing anything, then handle payment.captured,
payment.failed, and refund.processed events. Make this handler idempotent — store
processed Razorpay event IDs and short-circuit on a duplicate before doing any state
change. On payment.captured, cross-check the amount and order_id against the stored
contract exactly as specified in Part 3 step 7 before marking PAID. Implement a test
refund endpoint for the human-approval / dispute path.
Verify: manually trigger a Razorpay test-mode payment success, confirm the order
flips to PAID and the audit log shows the amount cross-check passing. Then replay
the same webhook payload a second time and confirm nothing double-processes.
```

### Phase 7 — Event-driven state machine + audit trail
```
Implement the state machine exactly as: REQUEST_RECEIVED -> OFFER_GENERATED ->
POLICY_APPROVED -> OFFER_ACCEPTED -> ORDER_CREATED -> PAYMENT_ATTEMPTED -> PAID |
FAILED | EXPIRED -> REFUNDED, plus APPROVAL_PENDING as a branch off OFFER_GENERATED
and FLAGGED as a branch off PAYMENT_ATTEMPTED (Part 3 step 7 mismatch case). Enforce
transitions in code — reject any attempt to jump states. Every transition writes an
AuditLogEntry answering: what happened, who/what initiated it (buyer agent id,
system, or a named human approver), what data was used, which policy_version
approved it, which specific rule was checked, why this particular offer/decision was
selected over alternatives, and the raw Razorpay API request/response where
applicable. Build the audit screen in apps/dashboard: a searchable timeline per
offer_id showing every entry in order.
Verify: pull up the SprintPro X2 example's full audit trail from request to PAID and
confirm every one of the "what/who/why" fields above is populated, not blank.
```

### Phase 8 — Merchant dashboard
```
Build the remaining dashboard screens: catalog CSV upload (reuses Phase 1 importer),
policy configuration form (min margin, max discount, free delivery threshold,
no-discount-fast-moving toggle, clearance window, approval threshold), a live feed
of incoming agent requests and the decisions made on them, and an approval queue for
anything sitting in APPROVAL_PENDING with an Approve/Reject action that writes to
the audit log with the human's identity.
Verify: change max_discount_pct from 12% to 8%, resubmit the SprintPro X2 request,
and confirm the engine now produces a smaller discount and the audit trail shows
policy_version incremented.
```

### Phase 9 — Multi-merchant auction extension
```
Simulate three merchant agents (A, B, C) each with their own catalog/policy seeded
per the brief's gift-box example (A: ₹29,500/Thursday/free branding, B:
₹28,900/Friday/no customization, C: ₹30,000/Wednesday/15-day replacement). Build a
broadcast flow: one buyer intent ("20 corporate gift boxes, ₹30,000 budget,
Bengaluru by Friday, prepaid") fans out to all three merchant offer-engines in
parallel, each independently runs Phases 3-5 against its own policy and produces its
own signed contract. The buyer-agent simulator then selects a winner using the
buyer's stated priority ranking (not just lowest price) and only that merchant's
contract proceeds to Phase 6. Build a UI that shows all three competing offers side
by side before the selection, so this is visibly a real comparison.
Verify: run it with priorities weighted toward delivery speed vs. weighted toward
price and confirm the simulator picks Merchant C in one run and Merchant B in the
other, with the reasoning stated.
```

### Phase 10 — Protocol adapters
```
Build services/adapters as thin, mostly-stubbed mappers: acp.ts, ucp.ts, ap2.ts,
mockUap.ts — each takes a protocol-shaped mock payload (you define a small
representative example JSON for each, don't try to fully implement any real
protocol spec) and maps it into the Common Commerce Object from Part 2. Add one
adapter test per protocol proving the mapping round-trips the required fields
(budget, deadline, quantity, payment preference at minimum). Note in code comments
where each real protocol's actual scope is broader than this mapper (e.g. AP2's
mandate verification is only stubbed here, not fully implemented) — this is
intentional scope control, not a gap to silently hide.
Verify: feed one mock ACP payload and one mock AP2 payload through their adapters
and confirm both land in the offer engine and produce a valid offer through the
same code path the simulator uses.
```

### Phase 11 — Failure scenario suite
```
Implement each of these as a triggerable scenario (a button in a "demo controls"
panel in the dashboard, not just a background test) so failures can be shown live:
1. Inventory race: offer signed for qty 2, inventory drops to 1 before accept ->
   accept-time re-check (Phase 5) catches it, offer is not silently fulfilled with
   qty 1 — it generates an alternative within the original mandate if one qualifies,
   else expires cleanly with no charge.
2. Offer tampering: accept request arrives with a modified final_price_paise ->
   signature verification fails, rejected before any Razorpay call.
3. Payment failure: Razorpay test-mode failure card -> system offers a different
   payment method, terms unchanged, does not re-discount to "win back" the sale.
4. Buyer exceeds mandate: accept request for an amount above buyer_constraints
   budget_max_paise -> rejected even if the merchant would have honored it.
5. Offer expiry: accept arrives after expires_at -> rejected, clearly distinct
   error from a signature failure.
6. Delivery promise becomes impossible: warehouse stock data changes after offer
   generation -> caught at accept-time, same alternative-or-expire pattern as (1).
7. LLM proposes an out-of-policy discount: force a bad Gemini suggestion in a test
   harness and confirm the policy engine rejects it and it never reaches signing.
8. Duplicate webhook: replay a captured Razorpay webhook -> idempotency check from
   Phase 6 short-circuits it, one audit entry notes the duplicate was ignored.
Verify: each of the 8 has a passing automated test AND is reachable from the demo
controls panel for a live walkthrough.
```

### Phase 12 — Simulation & measurement harness
```
Build simulation/buyer-load-test: generate 500-1000 synthetic buyer requests with
randomized but realistic budget/deadline/quantity/payment-preference combinations
drawn from a small set of product categories in the seeded catalog. Run each request
through two paths: (a) baseline — static list price, one universal coupon code, no
negotiation, no margin awareness; (b) DealFlow — the full engine. Record per request:
conversion (accepted y/n), final price, discount given, margin, whether prepaid was
incentivized, payment success. Output a report (markdown + a simple chart) comparing
the two paths on: conversion rate, average order value, gross margin per request,
discount cost per converted order, offer acceptance rate, payment success rate,
policy violation count (should be zero for DealFlow, non-zero/undefined for
baseline), human approval rate, and average decision latency. Label the report
clearly as simulated data with stated assumptions — do not present any percentage as
a claimed real-world result.
Verify: the report generates from a single command and the numbers are internally
consistent (e.g. total conversions matches the count of PAID-state offers in the DB
for that run).
```

### Phase 13 — Demo polish
```
Write a README with: one-paragraph pitch (DealFlow positioning from GEMINI.md), setup
instructions, and a scripted demo walkthrough in this order: (1) single-merchant
SprintPro X2 flow end to end including the audit trail, (2) the 3-merchant gift-box
auction with the side-by-side offer comparison and reasoned winner selection, (3) at
least 3 of the 8 failure scenarios triggered live from the demo controls panel, (4)
the measurement report from Phase 12. Add seed/reset scripts so the whole demo state
can be restored between run-throughs.
Verify: a person unfamiliar with the codebase can follow the README and complete the
full demo script without needing to read any code.
```

---

## Notes for using this in Antigravity specifically

- Use **Planning Mode** on each phase before letting the agent write code — you want the implementation plan artifact to review first, especially for Phase 3 (policy engine) and Phase 5 (contract service), since those are the two modules where a subtly wrong plan is expensive to unwind later.
- Consider a project **SKILL.md** (e.g. `policy-engine-invariants`) that restates the Part 4 rules, so any agent working anywhere in the repo — not just in Phase 3 — automatically loads that context when it touches pricing logic.
- Phases 9, 10, and 12 don't depend on each other once Phase 8 is done — good candidates to dispatch as parallel agents from the Agent Manager if you're short on time before a demo.
- Let the agent use its browser-in-the-loop verification on Phase 6 and Phase 9 in particular — actually clicking through Razorpay's test checkout and watching the webhook land is a better check than reading the code.
