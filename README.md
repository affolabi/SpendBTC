# SpendBTC ⚡

> **The Spending Layer for Bitcoin**  
> *A grant proposal and architectural blueprint for abstracting Bitcoin payment execution, conversion, and settlement behind familiar spending experiences.*

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Stacks%20%2F%20sBTC-orange.svg)](https://stacks.co)
[![Category](https://img.shields.io/badge/Category-Bitcoin%20Payments-blue.svg)]()
[![Stage](https://img.shields.io/badge/Project%20Stage-Grant%20Proposal%20%2F%20Concept-yellow.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

---

> ### 📌 Grant Application Notice
> **Project Stage:** Idea / Architecture Specification & Prototype Blueprint  
> **Target Ecosystem:** Stacks / sBTC / Bitcoin L2  
> **Purpose of this Repository:** This repository serves as the **grant proposal documentation, technical architecture blueprint, and interactive reference prototype**. It proves technical feasibility, domain modeling, and API design for grant evaluators and ecosystem reviewers. **No production infrastructure has been launched yet; this grant application seeks funding to bring this architecture to life.**

---

## 1. Executive Summary & Problem Statement

Bitcoin is world-class as a store of value and settlement layer, but spending it in everyday consumer transactions remains deeply fragmented. A typical Bitcoin holder who wants to pay for an everyday purchase priced in local fiat (e.g., **₦50,000** or **$35**) must:

```
Hold BTC ➔ Find compatible payment method ➔ Calculate conversion satoshis ➔ Swap/convert ➔ Find liquidity ➔ Execute L1 tx ➔ Wait 10-60 min ➔ Pay
```

This friction prevents Bitcoin from becoming everyday money and makes integration impossible for traditional fintech apps.

At the same time, existing Bitcoin payment solutions focus almost exclusively on **merchant acceptance**. SpendBTC focuses on the consumer and wallet side:

> **How can Bitcoin holders spend the Bitcoin they already own through familiar payment experiences?**

### The Core Principle
> **The user should think about the payment, not the Bitcoin infrastructure behind it.**

SpendBTC is designed as an **infrastructure translation layer** between:
- **Everyday Payment Experiences** (Cards, balances, local fiat amounts, 1-click checkouts)
- **Bitcoin & Stacks sBTC Capital** (1:1 Bitcoin backing, fast blocks, Clarity smart contract escrow)

---

## 2. System Architecture (Proposed Design)

SpendBTC abstracts execution behind a unified REST API and webhook pipeline connecting client applications to Stacks smart contracts:

```
                    USER / PARTNER APP
                            │
                            ▼
              ┌───────────────────────────┐
              │ SpendBTC UI / Partner App │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │       SpendBTC API        │
              └─────────────┬─────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │   Payment   │   │    Quote    │   │   Risk /    │
   │   Engine    │   │   Engine    │   │ Validation  │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
              ┌───────────────────────────┐
              │   Execution & Settlement  │
              └─────────────┬─────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        Stacks / sBTC               BTC Settlement
      (Clarity Escrow)              (Finality)
```

---

## 3. Core Technical Specifications

### 3.1 SpendBTC Account Model
Abstracts user balances into spendable fiat denominations (e.g. `$1,284.62` / `₦2,055,392`) mapped to underlying **BTC** and **sBTC** on the Stacks blockchain.

### 3.2 Payment Quote Engine (30-Second TTL)
Calculates exact required sBTC for any local fiat currency payment:
- **Inputs**: Amount (e.g. `₦50,000`), Currency (`NGN`), Asset (`sBTC`).
- **30-Second Rate Lock**: Prevents volatility and slippage during authorization.
- **Dynamic Liquidity Routing**: Compares Route A (Stacks Direct pool), Route B (Bitflow DEX aggregator), and Route C (Lightning Relayer) to recommend the optimal execution path.

### 3.3 Execution & Settlement State Machine
Coordinates atomic settlement across a 5-stage lifecycle:
```
  [QUOTED] ➔ [AUTHORIZED] ➔ [PROCESSING] ➔ [SUBMITTED] ➔ [CONFIRMED]
                                                               │
                                                       (or [FAILED])
```

### 3.4 Clarity Settlement Contract (`contracts/spendbtc-settlement.clar`)
Non-custodial smart contract specification on Stacks:
- Locks incoming sBTC tokens in escrow.
- Verifies recipient payment nonce and validity.
- Enforces automated protocol and relayer fee splits.
- Provides time-locked refund safety mechanisms if settlement is interrupted.

### 3.5 Risk & Validation Engine
- Balance sufficiency verification.
- Quote freshness enforcement (rejects expired quotes).
- Daily velocity and transaction spending limits.
- Idempotency & duplicate transaction prevention.

### 3.6 Partner Webhooks & Transaction Ledger
- Complete audit ledger logging Transaction ID, User ID, Asset, Fiat value, Recipient, Route, Fees, Status, and Stacks TxID.
- Webhook dispatcher with HMAC-SHA256 signature headers (`X-SpendBTC-Signature`) across all payment lifecycle events.

---

## 4. The Dual Experience Vision

### 4.1 Consumer Spending & Virtual Card Prototype
- **Spending Dashboard**: Shows fiat spending power with one-tap payment execution.
- **Virtual Card Concept**: Demonstrates how sBTC balances could back card-based spending (freeze/unfreeze controls, spend limits, online checkout) without SpendBTC needing to become a bank.

### 4.2 Developer & Partner Portal (The Real Product)
- **"The card is only the interface. The infrastructure is the product."**
- Enables crypto wallets, neobanks, and exchanges to integrate Bitcoin spending via REST APIs and Webhooks rather than building custom settlement rails.

---

## 5. API Specification (Planned Interface)

### Request Payment Quote
```http
POST /api/v1/payments/quote
Content-Type: application/json

{
  "amount": 50000,
  "currency": "NGN",
  "asset": "sBTC"
}
```
**Response:**
```json
{
  "quoteId": "quot_9f81a7...",
  "fiatAmount": 50000,
  "currency": "NGN",
  "asset": "sBTC",
  "assetAmount": "0.00042000",
  "networkFee": "0.00000150",
  "executionFee": "0.00000050",
  "totalAssetAmount": "0.00042200",
  "selectedRoute": "Route C (Lightning Relay)",
  "routes": [
    { "name": "Route A (Stacks Direct)", "feeFiat": 300, "estimatedSeconds": 4 },
    { "name": "Route B (Bitflow DEX)", "feeFiat": 150, "estimatedSeconds": 3 },
    { "name": "Route C (Lightning Relay)", "feeFiat": 80, "estimatedSeconds": 1, "recommended": true }
  ],
  "expiresAt": "2026-09-23T19:35:00Z",
  "ttlSeconds": 30
}
```

### Authorize & Settle Payment
```http
POST /api/v1/payments
Content-Type: application/json

{
  "quoteId": "quot_9f81a7...",
  "recipient": "Merchant Express (Shopify)",
  "route": "Route C"
}
```
**Response:**
```json
{
  "paymentId": "pay_5c93d2...",
  "status": "PROCESSING",
  "txHash": "0x3e18f2a41d996cb98fae...",
  "explorerUrl": "https://explorer.hiro.so/txid/0x3e18f2a4...demo?chain=testnet",
  "createdAt": "2026-09-23T19:34:40Z"
}
```

---

## 6. Grant Milestones & Requested Funding Scope

This grant will fund taking SpendBTC from this proposal and architectural blueprint into a fully operational, testnet-deployed settlement layer:

| Milestone | Deliverable | Focus Area |
| :---: | :--- | :--- |
| **M1** | **Clarity Contract Suite & Formal Verification** | Finalize `spendbtc-settlement.clar`, write comprehensive Clarinet tests, implement SIP-010 sBTC token handling, timelock refunds, and protocol fee mechanics. |
| **M2** | **Core Routing & Settlement Engine** | Production-grade Python/Node.js settlement engine, real-time oracle price feeds, and dynamic liquidity routing connecting Bitflow and ALEX pools. |
| **M3** | **Partner Developer Infrastructure & SDK** | Production REST API, partner SDK (`@spendbtc/sdk`), webhook delivery service with exponential backoff retries, and developer portal. |
| **M4** | **Testnet Deployment, Auditing & Pilot Integration** | Deployment to Stacks Testnet, end-to-end integration with a pilot Stacks wallet / fintech partner, security audit, and open community testing. |

---

## 7. Interactive Reference Prototype & Codebase

To demonstrate technical feasibility, this repository includes an **interactive reference prototype** implementing the proposed data flow:

```
SPENDBTC/
├── README.md                      # Grant Proposal & Technical Specification
├── run.sh                         # Prototype launcher script
├── contracts/
│   └── spendbtc-settlement.clar   # Clarity smart contract specification
├── backend/
│   ├── app.py                     # Reference API server & static router
│   ├── db.py                      # Prototype SQLite schema
│   ├── seed.py                    # Demonstration seed accounts & transactions
│   └── engine/
│       ├── quote.py               # Quote Engine (30s TTL, route comparison)
│       ├── risk.py                # Risk & validation checks
│       ├── execution.py           # Settlement state machine & Stacks Tx generation
│       └── webhook.py             # Webhook dispatcher with HMAC-SHA256 signatures
├── frontend/
│   ├── index.html                 # Prototype UI (Consumer app, Card concept, Dev portal)
│   ├── app.js                     # Interactive client logic & guided story walkthrough
│   └── styles.css                 # Fintech styling
└── tests/
    └── test_spendbtc.py           # Automated test suite (6 passing unit/integration tests)
```

### Running the Reference Prototype Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/affolabi/SpendBTC.git
   cd SpendBTC
   ```
2. Run the prototype launcher:
   ```bash
   ./run.sh
   ```
3. Open `http://localhost:8000` to interact with the prototype and run the guided architecture tour.

---

## 8. Ecosystem Impact

* **Accelerating sBTC Utility**: Directly expands the utility of sBTC beyond DeFi yield by turning it into everyday spending capital.
* **Non-Custodial Bitcoin Payments**: Enables users to spend Bitcoin without giving up custody to centralized exchanges or custodial card providers.
* **Fintech Bridge**: Lowers the barrier for Web2 fintechs, wallets, and neobanks to offer Bitcoin spending capabilities using Stacks smart contracts.

---

## 9. License

Released under the [MIT License](LICENSE). Built for the Bitcoin / Stacks Ecosystem.
