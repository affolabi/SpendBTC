;; ==============================================================================
;; SpendBTC - Settlement Contract
;; Ecosystem: Stacks / sBTC
;; Purpose: Non-custodial payment escrow, authorization, and settlement layer.
;; ==============================================================================

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

;; Default protocol fee: 10 basis points (0.10%)
(define-data-var protocol-fee-bps uint u10)
(define-data-var fee-collector principal tx-sender)

;; ------------------------------------------------------------------------------
;; Data Maps
;; ------------------------------------------------------------------------------
;; Payments map storing payment authorization, escrow details, and status
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

;; Authorize payment & escrow sBTC tokens
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
      ;; Record payment in pending escrow
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
        fiat: fiat-amount-cents,
        currency: fiat-currency
      })
      (ok payment-id)
    )
  )
)

;; Settle payment to merchant (can be called by payer or authorized relayer)
(define-public (settle-payment (payment-id (buff 32)))
  (let
    (
      (payment (unwrap! (get-payment payment-id) ERR-PAYMENT-NOT-FOUND))
    )
    (asserts! (is-eq (get status payment) "AUTHORIZED") ERR-PAYMENT-ALREADY-SETTLED)
    (asserts! (<= block-height (get expires-at-block payment)) ERR-PAYMENT-EXPIRED)
    
    ;; Update status to SETTLED
    (map-set payments
      { payment-id: payment-id }
      (merge payment { status: "SETTLED" })
    )

    (print {
      event: "payment-settled",
      payment-id: payment-id,
      merchant: (get merchant payment),
      amount: (get asset-amount payment)
    })
    (ok true)
  )
)

;; Refund expired or cancelled payment back to payer
(define-public (refund-payment (payment-id (buff 32)))
  (let
    (
      (payment (unwrap! (get-payment payment-id) ERR-PAYMENT-NOT-FOUND))
    )
    (asserts! (is-eq (get status payment) "AUTHORIZED") ERR-PAYMENT-ALREADY-SETTLED)
    (asserts! (> block-height (get expires-at-block payment)) ERR-PAYMENT-NOT-FOUND)
    
    (map-set payments
      { payment-id: payment-id }
      (merge payment { status: "REFUNDED" })
    )

    (print {
      event: "payment-refunded",
      payment-id: payment-id,
      payer: (get payer payment)
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
