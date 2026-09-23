from datetime import datetime, timezone
from backend.engine.quote import is_quote_expired

class RiskValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

def validate_payment_request(account: dict, quote: dict, recipient: str, daily_spent_fiat: float = 0.0):
    """
    PRD Section 13 & 14: Risk & Safety Engine
    Validates balance sufficiency, quote expiry, limits, and recipient safety.
    """
    # 1. Recipient check
    if not recipient or not recipient.strip():
        raise RiskValidationError("INVALID_RECIPIENT", "A valid recipient or merchant identifier is required.")

    # 2. Quote Expiry validation
    if is_quote_expired(quote["expires_at"]):
        raise RiskValidationError("QUOTE_EXPIRED", "This payment quote has expired. Please request a new quote.")

    # 3. Asset Balance Sufficiency
    required_sbtc = quote["total_asset_amount"]
    user_sbtc = account["sbtc_balance"]
    user_btc = account["btc_balance"]
    total_spendable = user_sbtc + user_btc

    if total_spendable < required_sbtc:
        raise RiskValidationError(
            "INSUFFICIENT_BALANCE",
            f"You don't have enough {quote['asset']} to complete this payment. Required: {required_sbtc:.8f}, Available: {total_spendable:.8f}"
        )

    # 4. Spending Limits Check
    daily_limit = account.get("spending_limit_fiat", 5000.0)
    payment_fiat_usd = quote.get("fiat_value_usd", 0.0)
    
    if (daily_spent_fiat + payment_fiat_usd) > daily_limit:
        raise RiskValidationError(
            "SPENDING_LIMIT_EXCEEDED",
            f"Payment of ${payment_fiat_usd:.2f} exceeds your remaining daily spending limit of ${(daily_limit - daily_spent_fiat):.2f}."
        )

    return True
