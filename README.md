# SpendBTC ⚡

> **The Spending Layer for Bitcoin**  
> *Abstracting Bitcoin payment execution, conversion, and settlement behind familiar spending experiences.*

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Stacks%20%2F%20sBTC-orange.svg)](https://stacks.co)
[![Category](https://img.shields.io/badge/Category-Bitcoin%20Payments-blue.svg)]()
[![Status](https://img.shields.io/badge/Status-Hackathon%20MVP-success.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

---

## 1. Executive Summary

Bitcoin is world-class as a store of value and settlement layer, but using it for everyday spending remains broken. A typical Bitcoin holder must convert assets, navigate decentralized exchanges or peer-to-peer desks, calculate fractional satoshis, wait 10–60 minutes for block confirmations, and manage slippage before completing a simple purchase.

**SpendBTC** inverts the equation:
Instead of forcing merchants or users to adopt unfamiliar crypto checkout flows, SpendBTC acts as an **infrastructure translation layer** between **Bitcoin capital** and **everyday payment experiences** (cards, local currency checkouts, fintech balances).

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

## 2. Product Architecture

SpendBTC consists of two interfaces backed by a modular payment orchestration engine:

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

## 3. Core Components

### 3.1 SpendBTC Account
Represents the user's available Bitcoin spending power in fiat terms (e.g. `$1,284.62` / `₦2,055,392`), backed transparently by their **BTC** (0.018 BTC) and **sBTC** (0.006 sBTC) balances on the Stacks blockchain.

### 3.2 Payment Quote Engine
Calculates the exact sBTC required for any fiat-denominated payment with a guaranteed **30-second locked exchange window**.
- **Inputs**: Amount (e.g. `₦50,000`), Currency (`NGN`), Asset (`sBTC`).
- **Outputs**: Required asset amount (`0.00042 sBTC`), Network fee breakdown, SpendBTC platform fee, Expiration countdown (`30s`).
- **Multi-Route Comparison**: Evaluates liquidity across multiple execution venues (Direct Stacks pool, Bitflow DEX aggregator, and Lightning relay) to dynamically select the lowest-cost, highest-reliability route.

### 3.3 Risk & Validation Engine
Protects funds and integrity before broadcasting transactions:
- Balance sufficiency verification.
- Quote freshness enforcement (rejects expired quotes).
- Daily & single-transaction velocity limits.
- Idempotency & duplicate payment prevention.
- Sanctioned address screening.

### 3.4 Execution & Settlement State Machine
Coordinates atomic settlement across a 5-stage lifecycle:
```
  [QUOTED] ➔ [AUTHORIZED] ➔ [PROCESSING] ➔ [SUBMITTED] ➔ [CONFIRMED]
                                                               │
                                                       (or [FAILED])
```
1. **QUOTED**: Rate locked for 30 seconds.
2. **AUTHORIZED**: User approves transaction via Stacks wallet (Leather / Xverse).
3. **PROCESSING**: Route locked and payment escrow initialized.
4. **SUBMITTED**: Clarity contract call broadcast to the Stacks network with testnet TxID.
5. **CONFIRMED**: Transaction included in block; settlement complete, webhook delivered.

### 3.5 Clarity Smart Contract (`spendbtc-settlement.clar`)
On-chain settlement contract deployed on Stacks:
- Locks incoming sBTC tokens in trustless escrow.
- Verifies merchant destination and payment nonce.
- Automatically handles protocol fee splits.
- Enforces time-locked dispute and refund mechanics.

### 3.6 Transaction Ledger & Webhooks
- **Audit Ledger**: Comprehensive audit records retaining Transaction ID, User ID, Asset, Amount, Fiat value, Recipient, Route, Fees, Status, and Blockchain Tx ID.
- **Webhook Dispatcher**: Signs payloads with HMAC-SHA256 headers (`X-SpendBTC-Signature`) to notify fintech partner servers across all lifecycle events:
  - `payment.created`
  - `payment.authorized`
  - `payment.processing`
  - `payment.submitted`
  - `payment.confirmed`
  - `payment.failed`

---

## 4. Dual Product Experience

### 4.1 Consumer Spending App & Virtual Card Prototype
- **Spending Dashboard**: Highlights available fiat spending power with one-tap access to pay, send, or top up.
- **Payment Modal**: Seamless payment execution in local currency (NGN, USD, EUR, etc.) with live route comparison.
- **Virtual Card Prototype**: Interactive debit card interface demonstrating card spending backed by sBTC:
  - Cardholder details, 16-digit PAN, CVV, and expiration.
  - Freeze / Unfreeze instant card controls.
  - Configurable daily spending limit.
  - "Online Checkout Simulator" to test merchant charges against sBTC balances.

### 4.2 Developer & Partner Portal
- **API Keys**: Manage Test (`spbtc_test_...`) and Live API credentials.
- **Live Webhook Inspector**: Register webhook endpoints, trigger test pings, and inspect JSON payloads and delivery status codes.
- **Interactive API Playground**: Test API endpoints directly in-browser (`POST /payments/quote`, `POST /payments`), preview live responses, and export code snippets in cURL, Python, and JavaScript/Node.js.
- **Platform Analytics**: Monitor transaction volume, sBTC throughput, API call counts, and success rates.

---

## 5. API Reference

All requests accept and return standard JSON. Authenticate requests using the `Authorization: Bearer <API_KEY>` header.

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
```
**Request Body:**
```json
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
```
**Request Body:**
```json
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

### Retrieve Transaction History
```http
GET /api/v1/transactions
GET /api/v1/transactions/:id
```

---

## 6. The Hackathon Demo Story

The application includes a guided **Hackathon Demo Tour** executing the exact 7-scene narrative from Section 21 of the PRD:

| Scene | Action | What is Demonstrated |
| :---: | :--- | :--- |
| **1** | Open SpendBTC | Available to spend is displayed prominently in fiat: **\$1,284.62** (0.018 BTC + 0.006 sBTC). |
| **2** | Select Pay | User initiates a payment for **₦50,000**. |
| **3** | Dynamic Quote | Quote engine calculates **0.00042 sBTC**, displays network & platform fees, route options, and locks rate for 30s. |
| **4** | Confirm | User reviews summary and approves the payment. |
| **5** | Wallet Signing | Stacks wallet (Leather/Xverse) authorization dialog is executed. |
| **6** | Processing | Engine progresses through `PROCESSING` ➔ `SUBMITTED` with live Stacks testnet TxID. |
| **7** | Settled & Switch | **₦50,000 Payment Successful** receipt appears. The presenter toggles to the **Developer Dashboard** to show the live webhook log and demonstrate that this entire flow integrates into any wallet or fintech via 3 API endpoints. |

---

## 7. Project Structure

```
SPENDBTC/
├── README.md                      # Comprehensive product and technical documentation
├── run.sh                         # One-click start script
├── contracts/
│   └── spendbtc-settlement.clar   # Clarity smart contract for sBTC escrow and settlement
├── backend/
│   ├── app.py                     # REST API server & static asset router
│   ├── db.py                      # SQLite database initialization & query helpers
│   ├── seed.py                    # Initial demo accounts, cards, transactions & API keys
│   └── engine/
│       ├── quote.py               # Quote Engine with real rates, 30s TTL, & multi-route comparison
│       ├── risk.py                # Risk Engine (balances, limits, quote expiry, idempotency)
│       ├── execution.py           # Payment execution state machine & Stacks settlement simulator
│       └── webhook.py             # Webhook dispatcher with HMAC-SHA256 signatures & event logger
├── frontend/
│   ├── index.html                 # Single-page application (Consumer app, Card prototype, Dev portal)
│   ├── app.js                     # Reactive client logic, state store, quote countdown, modals
│   └── styles.css                 # Clean fintech styling with Bitcoin/Stacks accents
└── tests/
    └── test_spendbtc.py           # Automated test suite for quotes, payments, risk, and webhooks
```

---

## 8. Quickstart & Installation

### Prerequisites
- Python 3.9+ (Standard macOS / Linux environment)
- Web browser (Chrome, Safari, Brave, Firefox)

### Running Locally
1. Clone or navigate to the project directory:
   ```bash
   cd /Users/macbook/Downloads/SPENDBTC
   ```
2. Start the SpendBTC server:
   ```bash
   ./run.sh
   # Or manually: python3 backend/app.py
   ```
3. Open your browser to:
   ```
   http://localhost:8000
   ```

### Running Automated Tests
```bash
python3 tests/test_spendbtc.py
```

---

## 9. Product Roadmap

- **Phase 1 — Hackathon (Current MVP)**
  - sBTC spending balance abstraction
  - Real-time quote engine with 30s TTL & route comparison
  - Settlement state machine with Stacks transaction tracking
  - Developer portal with API keys, webhooks, and interactive playground
  - Virtual card prototype
- **Phase 2 — Developer Infrastructure**
  - Production partner SDK (`@spendbtc/sdk`)
  - Mainnet sBTC Clarity contract deployment
  - Live Bitflow & ALEX decentralized liquidity pool routing
  - Automated partner settlement reconciliation
- **Phase 3 — Payment Integrations**
  - Licensed card issuing partner integration (virtual & physical cards)
  - Fiat off-ramp settlement rails (Local bank transfers, SEPA, ACH)
  - One-click checkout widget for e-commerce (Shopify, WooCommerce)
- **Phase 4 — Bitcoin Spending Network**
  - Universal spending layer embedded into major neobanks, crypto wallets, and payroll providers worldwide.

---

## 10. License

Released under the [MIT License](LICENSE). Built for the Bitcoin / Stacks Ecosystem.
