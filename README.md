# SpendBTC ⚡

> **The Spending Layer for Bitcoin**  
> *Abstracting Bitcoin payment execution, conversion, and settlement behind familiar spending experiences.*

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Stacks%20%2F%20sBTC-orange.svg)](https://stacks.co)
[![Category](https://img.shields.io/badge/Category-Bitcoin%20Payments-blue.svg)]()
[![Stage](https://img.shields.io/badge/Stage-Reference%20Prototype-yellow.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

---

## Current Status

**SpendBTC is currently a functional reference prototype** demonstrating the proposed consumer Bitcoin spending experience, payment architecture, API structure, quote and risk logic, payment state machine, developer flow, and frontend experience.

The current Clarity contract (`contracts/spendbtc-settlement.clar`) is a settlement specification and is **not yet deployed to Stacks testnet**. The current backend execution layer **simulates the settlement lifecycle** rather than broadcasting real sBTC transactions.

The next implementation phase is to connect the existing architecture to Stacks testnet and complete a real sBTC payment flow.

---

## 1. Product Overview & Thesis

> **“Spend Bitcoin like cash.”**

Bitcoin is world-class as a store of value and settlement network. However, holding Bitcoin is simple while spending it in everyday payment scenarios introduces significant user friction: finding compatible rails, calculating satoshi conversions, navigating swaps, managing slippage, and waiting for block confirmations.

SpendBTC focuses on the consumer and integrating application side:

> **Bitcoin is the asset.**  
> **sBTC is the programmable Bitcoin layer.**  
> **SpendBTC is the spending layer.**

SpendBTC is designed as an infrastructure translation layer between:
* **Bitcoin capital** (via sBTC on Stacks)
* **Everyday payment experiences** (cards, checkout interfaces, local currency amounts)

```
   Bitcoin (L1 Capital)
          │
          ▼
   sBTC (Programmable Bitcoin on Stacks)
          │
          ▼
   SpendBTC Payment Infrastructure (Quote • Risk • State Machine • APIs)
          │
          ▼
   Consumer / Wallet / Fintech Application
          │
          ▼
   Designated Recipient / Test Merchant
```

> **Core Principle:**  
> *The user should think about the payment, not the Bitcoin infrastructure behind it.*

---

## 2. SpendBTC and sBTC Payment Infrastructure

SpendBTC is complementary to merchant payment tooling such as **sBTC Pay**.

* **sBTC Pay** focuses primarily on the **merchant side**: helping merchants accept sBTC directly.
* **SpendBTC** focuses on the **consumer and integrating application side**: giving wallets, fintechs, exchanges, and other applications a standardized way to let their users spend BTC or sBTC.

SpendBTC provides the spending orchestration around quote generation, authorization, payment execution, transaction status, and developer APIs.

A future integration with merchant payment infrastructure can connect the consumer spending side with the merchant acceptance side. SpendBTC does not replace sBTC Pay, and the initial prototype does not integrate sBTC Pay.

---

## 3. MVP Payment Flow

A completed SpendBTC MVP payment represents a simple, verifiable flow:

```
User connects a Stacks wallet
           ↓
SpendBTC reads the user's sBTC balance
           ↓
SpendBTC generates a payment quote
           ↓
User reviews and authorizes the payment
           ↓
The user's wallet signs an sBTC testnet transaction
           ↓
sBTC is transferred to a designated test merchant/recipient address
           ↓
SpendBTC tracks the transaction and payment status
```

> **A completed MVP payment is a real sBTC testnet transfer from the user's connected Stacks wallet to a designated test merchant or recipient address.**

### What the MVP Does NOT Include
To maintain focus on the core spending infrastructure, the MVP explicitly excludes:
* Fiat conversion or banking off-ramps
* Physical card issuance
* Production card network processing
* Unrestricted production merchant payments
* SpendBTC custody of user funds

These are future product extensions outside the initial testnet MVP.

---

## 4. MVP Scope

### In Scope
* Stacks wallet connection (Leather / Xverse)
* sBTC balance verification
* Payment quote generation with time-to-live (TTL) expiration
* Payment authorization flow
* Real sBTC testnet transfer
* Designated test recipient / test merchant address
* Transaction state tracking (`QUOTED` ➔ `AUTHORIZED` ➔ `PROCESSING` ➔ `SUBMITTED` ➔ `CONFIRMED`)
* Payment history and status ledger
* Basic SpendBTC REST API
* Developer documentation and reference endpoints
* Failure handling and risk validation (balance sufficiency, quote expiration)

### Out of Scope for MVP
* Physical cards
* Production card issuance
* Fiat conversion
* Production merchant settlement
* Unrestricted mainnet payments
* Complex multi-route liquidity aggregation
* Lightning network integration
* Large-scale payment network infrastructure

---

## 5. System Architecture

SpendBTC coordinates payment orchestration between consumer/partner apps and Stacks payment state:

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
                            ▼
              ┌───────────────────────────┐
              │       Stacks / sBTC       │
              │  Settlement & Payment     │
              │          State            │
              └───────────────────────────┘
```

---

## 6. Core Components (Reference Implementation)

### 6.1 SpendBTC Account Model
Represents the user's available spending power in familiar terms, backed by their underlying sBTC balance on Stacks.

### 6.2 Payment Quote Engine (30-Second TTL)
Before executing a payment, SpendBTC calculates how much sBTC is required:
* **Inputs**: Payment amount, currency, asset (`sBTC`).
* **Outputs**: Required asset amount, network fee estimation, execution fee, expiration countdown (30 seconds).
* **Quote Freshness**: Quotes expire after 30 seconds to protect against rate volatility.

### 6.3 Risk & Validation Engine
Validates transactions before execution:
* **Balance Sufficiency**: Verifies the connected account holds sufficient sBTC.
* **Quote Expiry**: Rejects payments attempted against expired quotes.
* **Spending Limits**: Enforces configurable transaction limits.
* **Duplicate Detection**: Prevents double-submission of identical payment requests.

### 6.4 Payment State Machine
Coordinates payment lifecycle states:
```
  [QUOTED] ➔ [AUTHORIZED] ➔ [PROCESSING] ➔ [SUBMITTED] ➔ [CONFIRMED]
                                                               │
                                                       (or [FAILED])
```
* In the current prototype, state progression and transaction hashes are simulated.
* In the next phase, `SUBMITTED` and `CONFIRMED` map directly to broadcasted Stacks testnet transactions.

### 6.5 Clarity Settlement Contract (`contracts/spendbtc-settlement.clar`)
A Clarity smart contract specification that records payment state, merchant recipients, nonces, and settlement records on Stacks.  
*(Note: In the current prototype, the contract serves as an architectural specification and will be connected to real sBTC transfers during the testnet implementation.)*

### 6.6 Webhooks & Audit Ledger
* **Audit Ledger**: Comprehensive payment record retaining Transaction ID, account, asset, amount, recipient, status, and transaction hash.
* **Webhooks**: Dispatches payment lifecycle events (`payment.created`, `payment.authorized`, `payment.processing`, `payment.submitted`, `payment.confirmed`, `payment.failed`) with HMAC-SHA256 signatures (`X-SpendBTC-Signature`).

---

## 7. Interfaces

### 7.1 Consumer Spending App
* **Spending View**: Displays available sBTC balance translated into a familiar spending figure.
* **Payment Flow**: Step-by-step payment initiation, quote review, and confirmation.

### 7.2 Virtual Card Concept (Future Vision)
The prototype includes a visual virtual card demonstration:
* Shows how sBTC balances could eventually interface with standard payment rails.
* Controls: Freeze/unfreeze toggle, spend limits slider, simulated charge.
* **Important Note:** *The card is not the MVP product. The infrastructure is the product.* Actual card issuance, compliance, and card network integration are future work and outside the initial testnet MVP.

### 7.3 Developer & Partner Portal
Demonstrates how external wallets or fintechs can integrate SpendBTC:
* API key management (`spbtc_test_...`)
* Webhook log inspection
* In-browser API explorer to test quote generation and payment execution

---

## 8. API Specification (Planned & Reference Interface)

All requests and responses use standard JSON.

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
**Reference Response:**
```json
{
  "quoteId": "quot_9f81a7d2b4c1",
  "fiatAmount": 50000,
  "currency": "NGN",
  "asset": "sBTC",
  "assetAmount": 0.00042,
  "networkFee": 0.000001,
  "executionFee": 0.0000005,
  "totalAssetAmount": 0.0004215,
  "expiresAt": "2026-09-23T23:30:00Z",
  "ttlSeconds": 30
}
```

### Authorize & Settle Payment
```http
POST /api/v1/payments
Content-Type: application/json

{
  "quoteId": "quot_9f81a7d2b4c1",
  "recipient": "SpendBTC Test Merchant"
}
```
**Reference Response:**
```json
{
  "paymentId": "pay_5c93d2e1a0b8",
  "status": "CONFIRMED",
  "txHash": "0x3e18f2a41d996cb98fae28374829104719283741928374918273948172938471",
  "createdAt": "2026-09-23T23:30:15Z"
}
```

---

## 9. Future Routing and Settlement

The current MVP focuses exclusively on the direct path:
```
User wallet ➔ SpendBTC ➔ sBTC ➔ Designated Test Recipient
```

Future iterations may evaluate and incorporate:
* Decentralized liquidity routing (e.g. Bitflow, ALEX)
* Lightning Network interoperability
* Fiat settlement rails (SEPA, ACH, local bank transfers)
* Direct merchant payment protocol integrations (such as sBTC Pay)
* Regulated card issuer integrations

These capabilities are architectural extensions and are not part of the initial MVP.

---

## 10. Repository Structure

```
SPENDBTC/
├── README.md                      # Architecture documentation & technical overview
├── run.sh                         # Local prototype launcher script
├── contracts/
│   └── spendbtc-settlement.clar   # Clarity settlement smart contract specification
├── backend/
│   ├── app.py                     # Reference REST API server & static asset router
│   ├── db.py                      # SQLite database schema (accounts, quotes, payments, webhooks)
│   ├── seed.py                    # Demonstration seed data (test accounts, mock cards, ledger)
│   └── engine/
│       ├── quote.py               # Quote Engine (real-time calculation, 30s TTL)
│       ├── risk.py                # Risk Engine (balance sufficiency, quote expiration, limits)
│       ├── execution.py           # Simulated settlement state machine & transaction ledger
│       └── webhook.py             # Webhook dispatcher with HMAC-SHA256 signatures
├── frontend/
│   ├── index.html                 # Single-page UI (Consumer app, Card concept, Dev portal)
│   ├── app.js                     # Prototype client logic, countdown timer, interactive tour
│   └── styles.css                 # Clean fintech styling
└── tests/
    └── test_spendbtc.py           # Automated test suite (6 passing unit/integration tests)
```

---

## 11. Running the Reference Prototype Locally

### Prerequisites
* Python 3.9+ (macOS / Linux)
* Modern web browser

### Quickstart
1. Clone the repository:
   ```bash
   git clone https://github.com/affolabi/SpendBTC.git
   cd SpendBTC
   ```
2. Start the local server:
   ```bash
   ./run.sh
   # Or directly: python3 backend/app.py
   ```
3. Open `http://localhost:8000` in your browser.

### Running Automated Tests
```bash
python3 tests/test_spendbtc.py
```

---

## 12. Product Roadmap

### Phase 1 — Reference Prototype (Completed)
* End-to-end consumer payment user experience
* Reference frontend interface
* REST API structure and endpoints
* Quote engine logic with 30-second TTL
* Risk and validation rules (balance sufficiency, quote expiration)
* Payment state machine orchestration
* Webhook event structure with HMAC signatures
* Clarity settlement contract specification (`contracts/spendbtc-settlement.clar`)
* Automated test suite (6/6 tests passing)

### Phase 2 — Stacks Testnet MVP (Next Implementation)
* Deploy Clarity settlement contract to Stacks testnet
* Connect Stacks wallet signing (Leather / Xverse)
* Execute real sBTC testnet transfers to designated test recipients
* Connect transaction confirmation tracking via Stacks node / Hiro APIs
* Complete end-to-end payment test on testnet
* Publish formal developer documentation and integration guides

### Phase 3 — Future Expansion (Planned)
* Liquidity and DEX routing
* Additional settlement providers
* Merchant payment tooling integrations (e.g. sBTC Pay)
* Fiat off-ramp settlement rails
* Card issuer integrations
* Broader wallet, fintech, and exchange SDKs

---

## 13. License

Released under the [MIT License](LICENSE). Built for the Stacks / Bitcoin ecosystem.
