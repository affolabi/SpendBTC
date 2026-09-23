# SpendBTC ⚡

> **The Spending Layer for Bitcoin**  
> *Abstracting Bitcoin payment execution, conversion, and settlement behind familiar spending experiences.*

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Stacks%20%2F%20sBTC-orange.svg)](https://stacks.co)
[![Category](https://img.shields.io/badge/Category-Bitcoin%20Payments-blue.svg)]()
[![Stage](https://img.shields.io/badge/Stage-Architecture%20%26%20Reference%20Prototype-blue.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

---

## 1. Product Overview

SpendBTC is an infrastructure product designed to enable wallets, fintechs, and crypto applications to give users a familiar, effortless way to spend BTC and sBTC.

Today, holding Bitcoin is simple, but spending it in everyday payment scenarios requires jumping through complex hoops: finding compatible payment methods, manually calculating conversion amounts in satoshis, navigating decentralized swaps, finding liquidity pools, executing L1 transactions, waiting 10–60 minutes for block confirmations, and managing slippage.

**SpendBTC inverts this paradigm:**
The product abstracts the complexity of Bitcoin payment execution, conversion, and settlement behind a simple, familiar spending experience.

```
   ┌────────────────────────────────────────────────────────┐
   │                     Everyday World                     │
   │       ₦50,000 / $35 / Virtual Card / QR Checkout       │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │                        SpendBTC                        │
   │   The Spending Layer (Quote • Route • Risk • Settle)   │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │                   Stacks / sBTC Rails                  │
   │    1:1 Bitcoin backing, fast blocks, Clarity escrow    │
   └────────────────────────────────────────────────────────┘
```

> **Core Principle:**  
> *The user should think about the payment, not the Bitcoin infrastructure behind it.*

---

## 2. The Problem & Market Opportunity

### The Problem
Most Bitcoin payment infrastructure historically focuses on **merchant acceptance** (e.g., getting a shop to accept BTC).

SpendBTC addresses the other side of the equation:
> **How can Bitcoin holders spend the Bitcoin they already own through payment experiences they already understand?**

People already understand:
* Cards (debit / credit)
* Payment balances in their local currency
* One-tap authorization
* QR checkouts & payment confirmations

They should not need to understand:
* Stacks L2 transactions & contract calls
* Liquidity pools & automated market makers
* Routing algorithms & slippage tolerances
* Block confirmation times

### The Solution: A Translation Layer
SpendBTC acts as a translation layer between **Bitcoin capital** and **everyday payment infrastructure**, allowing any wallet or fintech partner to embed Bitcoin spending directly into their existing product.

---

## 3. System Architecture

SpendBTC connects consumer-facing partner applications to Stacks / sBTC settlement rails through a unified API:

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

## 4. Core Components

### 4.1 SpendBTC Account
Represents the user's available spending power in fiat terms (e.g., `$1,284.62` / `₦2,055,392`), backed transparently by their underlying **BTC** and **sBTC** balances on the Stacks blockchain.

### 4.2 Payment Quote Engine (30-Second TTL)
Before executing a payment, SpendBTC dynamically calculates how much sBTC is required:
* **Inputs**: Payment amount (e.g. `₦50,000`), fiat currency (`NGN`), asset being spent (`sBTC`).
* **Outputs**: Required asset amount (`0.00042 sBTC`), network fee breakdown, execution fee, expiration countdown (`30 seconds`).
* **Multi-Route Liquidity Comparison**: Compares multiple execution routes to automatically select the optimal path:
  - **Route A (Stacks Direct Pool)**: Native Stacks L2 settlement escrow.
  - **Route B (Bitflow DEX Aggregator)**: Decentralized liquidity routing.
  - **Route C (Lightning Relayer)**: Fast-path payment relayer with micro-batching (Recommended best rate).

### 4.3 Risk & Validation Engine
Validates transactions before execution to protect user capital:
* **Balance Sufficiency**: Verifies user has adequate sBTC/BTC.
* **Quote Freshness**: Enforces 30-second TTL to eliminate slippage risk.
* **Spending Limits**: Enforces daily velocity and single-transaction limits.
* **Idempotency**: Prevents duplicate payment submissions.

### 4.4 Execution & Settlement State Machine
Coordinates atomic settlement across a 5-stage lifecycle:
```
  [QUOTED] ➔ [AUTHORIZED] ➔ [PROCESSING] ➔ [SUBMITTED] ➔ [CONFIRMED]
                                                               │
                                                       (or [FAILED])
```

### 4.5 Clarity Smart Contract (`contracts/spendbtc-settlement.clar`)
On-chain non-custodial smart contract specification on Stacks:
* Holds sBTC tokens in trustless escrow during authorization.
* Verifies recipient payment nonce and merchant address.
* Automatically splits protocol and relayer fees.
* Includes time-locked dispute and refund mechanics.

### 4.6 Webhooks & Transaction Ledger
* **Audit Ledger**: Complete audit record retaining Transaction ID, User ID, Asset, Fiat value, Recipient, Route, Fees, Status, and Blockchain TxID.
* **HMAC-Signed Webhooks**: Dispatches events (`payment.created`, `payment.authorized`, `payment.processing`, `payment.submitted`, `payment.confirmed`, `payment.failed`) to partner servers with `X-SpendBTC-Signature` headers.

---

## 5. Dual Product Experience

### 5.1 Consumer Spending & Virtual Card Prototype
* **Spending Dashboard**: Highlights available spending power with one-tap payment execution.
* **Virtual Card Concept**: Demonstrates how sBTC balances could back card-based spending (freeze/unfreeze controls, spend limits, online checkout simulator).
* *Note: The virtual card is an interface demonstration of the intended future experience. SpendBTC focuses on the underlying infrastructure layer.*

### 5.2 Developer & Partner Portal (The Core Product)
* **"The card is only the interface. The infrastructure is the actual product."**
* Enables crypto wallets, neobanks, and fintechs to integrate Bitcoin spending without rebuilding payment rails.
* Includes API key management (`spbtc_test_...`), live webhook inspection, and an in-browser interactive API playground.

---

## 6. API Reference (Planned Interface)

### Accounts & Balances
```http
GET /api/v1/accounts
GET /api/v1/accounts/:id/balance
```
**Response:**
```json
{
  "accountId": "acc_01h8x9p3...",
  "fiatCurrency": "USD",
  "totalSpendingPowerFiat": 1284.62,
  "balances": {
    "btc": "0.01800000",
    "sbtc": "0.00600000"
  },
  "stacksAddress": "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"
}
```

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

## 7. Interactive Reference Prototype

This repository includes a fully functional, self-contained reference prototype that models the proposed data flows, quote calculations, state machine transitions, and developer APIs:

```
SPENDBTC/
├── README.md                      # Product Overview & Technical Specification
├── run.sh                         # One-click local launcher
├── contracts/
│   └── spendbtc-settlement.clar   # Clarity smart contract specification
├── backend/
│   ├── app.py                     # API server & static asset router
│   ├── db.py                      # SQLite database schema
│   ├── seed.py                    # Demonstration accounts & transaction history
│   └── engine/
│       ├── quote.py               # Quote Engine (30s TTL, route comparison)
│       ├── risk.py                # Risk & validation checks
│       ├── execution.py           # Settlement state machine & Stacks Tx generation
│       └── webhook.py             # Webhook dispatcher with HMAC signatures
├── frontend/
│   ├── index.html                 # Single-page UI (Consumer app, Card concept, Dev portal)
│   ├── app.js                     # Interactive client logic & guided story walkthrough
│   └── styles.css                 # Clean fintech styling
└── tests/
    └── test_spendbtc.py           # Automated test suite (6 passing unit/integration tests)
```

### Running Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/affolabi/SpendBTC.git
   cd SpendBTC
   ```
2. Run the launcher:
   ```bash
   ./run.sh
   ```
3. Open `http://localhost:8000` in your browser.

---

## 8. Product Roadmap

- **Phase 1 — Specification & Prototype (Current)**
  - Core architectural blueprint and PRD
  - Reference Clarity escrow contract (`spendbtc-settlement.clar`)
  - Quote engine design with 30s rate lock & multi-route comparison
  - Interactive reference prototype & developer portal
- **Phase 2 — Developer Infrastructure**
  - Production-grade API & partner SDK (`@spendbtc/sdk`)
  - Mainnet & Testnet Clarity contract deployment
  - Live DEX liquidity aggregation (Bitflow, ALEX)
  - Partner webhook infrastructure with automated retries
- **Phase 3 — Payment Integrations**
  - Licensed card issuing partner integration (virtual & physical cards)
  - Fiat off-ramp settlement rails (Local bank transfers, SEPA, ACH)
  - One-click checkout widget for e-commerce (Shopify, WooCommerce)
- **Phase 4 — Bitcoin Spending Network**
  - Universal spending layer embedded into major neobanks, crypto wallets, and payroll platforms.

---

## 9. License

Released under the [MIT License](LICENSE). Built for the Bitcoin / Stacks Ecosystem.
