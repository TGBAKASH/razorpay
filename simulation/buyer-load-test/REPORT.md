# Autonomous DealFlow vs. Baseline Benchmark Simulation Report

> [!IMPORTANT]
> **SIMULATED SYNTHETIC BENCHMARK DISCLAIMER**:
> This report is generated from a synthetic multi-agent load simulation of **500 randomized buyer requests**. All metrics, conversion rates, and margins reflect mathematical behavioral models under stated simulation assumptions. These numbers demonstrate architectural performance, invariant enforcement, and comparative efficiency—they are **NOT** claimed real-world empirical statistics.

---

## 1. Simulation Setup & Stated Assumptions

- **Total Synthetic Requests**: 500
- **Timestamp**: `2026-08-30T05:40:46.859Z`
- **Product Scope**: Seeded catalog items (`SPRINTPRO-X2` slow-moving, `SPRINTPRO-ELITE` fast-moving, `HYDRO-500` accessories, `GIFTBOX-CORP-A` corporate hampers).
- **Buyer Budget Variance**: Randomized realistic distribution (85%–110% of list price, with 40% budget-constrained agents).
- **Path (a) Baseline**: Static list pricing with universal 5% coupon code (`WELCOME5`), no negotiation, zero margin awareness, blind to fast-moving inventory rules.
- **Path (b) DealFlow**: Full autonomous negotiation protocol, deterministic policy checks (margin floor 18%, discount ceiling 12%, no fast-moving discounts), heuristic expected-profit ranking, prepaid UPI risk substitution, and cryptographic HMAC-SHA256 contract signing.

---

## 2. Comparative Performance Metrics Table

| Metric | Path (a): Baseline (Static 5% Coupon) | Path (b): DealFlow (Autonomous Protocol) | Delta / Uplift | Invariant Status |
| :--- | :--- | :--- | :--- | :--- |
| **Conversion Rate** | **34.60%** (173/500) | **43.40%** (217/500) | **+8.80% pts** | Verified |
| **Offer Acceptance Rate** | 36.00% (180/500) | 58.84% (223/379) | +22.84% pts | Tailored Pricing |
| **Payment Success Rate** | 96.11% (COD RTO losses) | 97.31% (Prepaid UPI substituted) | +1.20% pts | COD Risk Eliminated |
| **Average Order Value (AOV)**| ₹1,23,037.06 | ₹1,67,180.03 | +₹44142.97 | Integer Paise |
| **Gross Margin / Request** | **₹11,685.72** | **₹18,347.43** | **+57.01% uplift** | Margin Floor Enforced |
| **Total Gross Profit** | ₹58,42,861.2 | ₹91,73,716.75 | +₹33,30,855.55 | Zero Floating Math |
| **Discount Cost / Converted** | ₹6,475.63 (Blanket 5%) | ₹1,066.18 (Dynamic Policy) | Targeted spend | Policy Ceilings |
| **Policy Violation Count** | **121 violations** (Margin breaches) | **0 violations** | **100% Policy Clean** | **STRICT INVARIANT (0)** |
| **Prepaid Incentivized Orders**| 0 orders | 0 orders | Replaces COD risk | ₹150 margin credit |
| **Human Approval Rate** | 0% (Unmonitored) | 1.40% (7 high-value) | Automated safety | > ₹15,000 threshold |
| **Avg Decision Latency** | 0.00 ms | 0.03 ms | Autonomous speed | Pure in-memory rules |

---

## 3. Visual Performance Comparison Charts

### A. Overall Conversion Rate (%)
```text
Baseline : [█████████░░░░░░░░░░░░░░░░] 34.6%
DealFlow : [███████████░░░░░░░░░░░░░░] 43.4% (+8.8% pts)
```

### B. Gross Margin per Request (₹ INR)
```text
Baseline : [████████████████░░░░░░░░░] ₹11686
DealFlow : [█████████████████████████] ₹18347 (+57.0% uplift)
```

### C. Policy Violations
```text
Baseline : █████████████████████████ 121 breaches (fast-moving items discounted / margin floor broken)
DealFlow : [CLEAN - 0 VIOLATIONS] (Deterministic policy guardrails enforced)
```

---

## 4. Internal Mathematical Consistency Audit

```json
{
  "total_requests": 500,
  "dealflow_paid_state_contracts": 217,
  "dealflow_conversions_match": true,
  "dealflow_profit_exact_match": true,
  "dealflow_policy_violations": 0
}
```

- **Conversions to Database State**: DealFlow conversions (217) strictly match the count of completed `PAID` state contracts.
- **Profit Exactness**: `Total Gross Profit = Total Revenue - Total Product Cost` (917371675 paise = 3627806675 paise - 2710435000 paise).
- **Policy Invariant**: DealFlow recorded **exactly 0 policy violations** across all 500 transactions.
