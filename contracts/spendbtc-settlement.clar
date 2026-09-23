;; ==============================================================================
;; SpendBTC - Settlement Contract (Stacks / sBTC)
;; Purpose: Reference settlement specification for non-custodial sBTC payments,
;;          authorizations, fee routing, and time-locked dispute refunds.
;; ==============================================================================

;; ------------------------------------------------------------------------------
;; Traits Definition
;; ------------------------------------------------------------------------------
;; SIP-010 Fungible Token Trait Definition for sBTC Compatibility
(define-trait sip-010-ft-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 10) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; ------------------------------------------------------------------------------
;; Constants & Error Codes
;; ------------------------------------------------------------------------------
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PAYMENT-NOT-FOUND (err u101))
(define-constant ERR-PAYMENT-ALREADY-SETTLED (err u102))
(define-constant ERR-PAYMENT-EXPIRED (err u103))
(define-constant ERR-INSUFFICIENT-FEE (err u104))
(define-constant ERR-INVALID-AMOUNT (err u105))
(define-constant ERR-TOKEN-TRANSFER-FAILED (err u106))

;; Default protocol fee: 10 basis points (0.10%)
(define-data-var protocol-fee-bps uint u10)
(define-data-var fee-collector principal tx-sender)

;; ------------------------------------------------------------------------------
;; Data Maps
;; ------------------------------------------------------------------------------
(define-map payments
  { payment-id: (buff 32) }
  {
    payer: principal,
    merchant: principal,
    asset-amount: uint,
    fiat-amount-cents: uint,
    fiat-currency: (string-ascii 3),
    fee-amount: uint,
    created-at-block: uint,
    expires-at-block: uint,
    status: (string-ascii 16) ;; "AUTHORIZED", "SETTLED", "REFUNDED"
  }
)

;; ------------------------------------------------------------------------------
;; Read-Only Functions
;; ------------------------------------------------------------------------------
(define-read-only (get-payment (payment-id (buff 32)))
  (map-get? payments { payment-id: payment-id })
)

(define-read-only (get-protocol-fee-bps)
  (var-get protocol-fee-bps)
)

(define-read-only (get-fee-collector)
  (var-get fee-collector)
)

(define-read-only (calculate-protocol-fee (amount uint))
  (/ (* amount (var-get protocol-fee-bps)) u10000)
)

;; ------------------------------------------------------------------------------
;; Public Functions
;; ------------------------------------------------------------------------------

;; Authorize payment & register escrow intent
(define-public (authorize-payment
    (payment-id (buff 32))
    (merchant principal)
    (asset-amount uint)
    (fiat-amount-cents uint)
    (fiat-currency (string-ascii 3))
    (duration-blocks uint))
  (begin
    (asserts! (> asset-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (is-none (get-payment payment-id)) ERR-PAYMENT-ALREADY-SETTLED)
    
    (let
      (
        (protocol-fee (calculate-protocol-fee asset-amount))
        (expiry (+ block-height duration-blocks))
      )
      (map-set payments
        { payment-id: payment-id }
        {
          payer: tx-sender,
          merchant: merchant,
          asset-amount: asset-amount,
          fiat-amount-cents: fiat-amount-cents,
          fiat-currency: fiat-currency,
          fee-amount: protocol-fee,
          created-at-block: block-height,
          expires-at-block: expiry,
          status: "AUTHORIZED"
        }
      )
      
      (print {
        event: "payment-authorized",
        payment-id: payment-id,
        payer: tx-sender,
        merchant: merchant,
        amount: asset-amount,
        fee: protocol-fee,
        fiat: fiat-amount-cents,
        currency: fiat-currency
      })
      (ok payment-id)
    )
  )
)

;; Settle payment to merchant (SIP-010 compatible transfer call)
(define-public (settle-payment
    (payment-id (buff 32))
    (token-trait <sip-010-ft-trait>))
  (let
    (
      (payment (unwrap! (get-payment payment-id) ERR-PAYMENT-NOT-FOUND))
      (net-amount (- (get asset-amount payment) (get fee-amount payment)))
      (collector (var-get fee-collector))
    )
    (asserts! (is-eq (get status payment) "AUTHORIZED") ERR-PAYMENT-ALREADY-SETTLED)
    (asserts! (<= block-height (get expires-at-block payment)) ERR-PAYMENT-EXPIRED)
    
    ;; Transfer net sBTC to merchant
    (try! (contract-call? token-trait transfer net-amount (as-contract tx-sender) (get merchant payment) (some 0x7370656e646274632d736574746c65)))
    
    ;; Transfer protocol fee to collector
    (if (> (get fee-amount payment) u0)
      (try! (contract-call? token-trait transfer (get fee-amount payment) (as-contract tx-sender) collector (some 0x7370656e646274632d666565)))
      true
    )

    (map-set payments
      { payment-id: payment-id }
      (merge payment { status: "SETTLED" })
    )

    (print {
      event: "payment-settled",
      payment-id: payment-id,
      merchant: (get merchant payment),
      net-amount: net-amount,
      fee-amount: (get fee-amount payment)
    })
    (ok true)
  )
)

;; Refund expired payment back to payer
(define-public (refund-payment
    (payment-id (buff 32))
    (token-trait <sip-010-ft-trait>))
  (let
    (
      (payment (unwrap! (get-payment payment-id) ERR-PAYMENT-NOT-FOUND))
    )
    (asserts! (is-eq (get status payment) "AUTHORIZED") ERR-PAYMENT-ALREADY-SETTLED)
    (asserts! (> block-height (get expires-at-block payment)) ERR-PAYMENT-NOT-FOUND)
    
    ;; Return full asset amount back to payer
    (try! (contract-call? token-trait transfer (get asset-amount payment) (as-contract tx-sender) (get payer payment) (some 0x7370656e646274632d726566756e64)))

    (map-set payments
      { payment-id: payment-id }
      (merge payment { status: "REFUNDED" })
    )

    (print {
      event: "payment-refunded",
      payment-id: payment-id,
      payer: (get payer payment),
      amount: (get asset-amount payment)
    })
    (ok true)
  )
)

;; Admin: Update protocol fee
(define-public (set-protocol-fee-bps (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set protocol-fee-bps new-fee-bps)
    (ok true)
  )
)

;; Admin: Update fee collector
(define-public (set-fee-collector (new-collector principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set fee-collector new-collector)
    (ok true)
  )
)
