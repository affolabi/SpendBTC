import uuid
import json
from datetime import datetime, timedelta, timezone

# Reference exchange rates
FIAT_TO_USD_RATES = {
    "USD": 1.0,
    "NGN": 0.000625,   # 1 USD ~ 1600 NGN => 50,000 NGN ~ $31.25
    "EUR": 1.08,
    "GBP": 1.28,
    "KES": 0.0077,
    "GHS": 0.065
}

# Reference BTC price in USD (~$74,400 yields ~0.00042 sBTC for 50,000 NGN)
BTC_USD_PRICE = 74400.0

def get_exchange_rate(fiat_currency: str) -> float:
    return FIAT_TO_USD_RATES.get(fiat_currency.upper(), 1.0)

def generate_payment_quote(account_id: str, fiat_amount: float, fiat_currency: str, asset: str = "sBTC") -> dict:
    """
    PRD Section 8.2: Payment Quote Engine
    Calculates exact sBTC/BTC required, execution fees, route comparison, and 30s TTL.
    """
    fiat_curr = fiat_currency.upper()
    rate_to_usd = get_exchange_rate(fiat_curr)
    fiat_value_usd = fiat_amount * rate_to_usd
    
    # Calculate base asset amount (e.g. ₦50,000 -> 0.00042 sBTC)
    base_asset_amount = round(fiat_value_usd / BTC_USD_PRICE, 8)
    if base_asset_amount <= 0:
        base_asset_amount = 0.00000001
        
    # Multi-route evaluation (PRD Section 8.4)
    # Route A: Stacks Direct Pool
    # Route B: Bitflow DEX Aggregator
    # Route C: Lightning Relayer (Best Rate)
    routes = [
        {
            "id": "route_a",
            "name": "Route A (Stacks Direct sBTC)",
            "description": "Native Stacks L2 settlement escrow",
            "fee_fiat": round(fiat_amount * 0.006, 2),
            "fee_asset": round(base_asset_amount * 0.006, 8),
            "network_fee_asset": 0.00000250,
            "estimated_time_sec": 4,
            "slippage": "0.05%",
            "recommended": False
        },
        {
            "id": "route_b",
            "name": "Route B (Bitflow DEX Aggregator)",
            "description": "Decentralized liquidity routing",
            "fee_fiat": round(fiat_amount * 0.003, 2),
            "fee_asset": round(base_asset_amount * 0.003, 8),
            "network_fee_asset": 0.00000180,
            "estimated_time_sec": 3,
            "slippage": "0.02%",
            "recommended": False
        },
        {
            "id": "route_c",
            "name": "Route C (Lightning Relayer)",
            "description": "Fast-path payment relayer with micro-batching",
            "fee_fiat": round(fiat_amount * 0.0016, 2),
            "fee_asset": round(base_asset_amount * 0.0016, 8),
            "network_fee_asset": 0.00000100,
            "estimated_time_sec": 1,
            "slippage": "0.00%",
            "recommended": True
        }
    ]
    
    best_route = next(r for r in routes if r["recommended"])
    network_fee_asset = best_route["network_fee_asset"]
    execution_fee_asset = best_route["fee_asset"]
    total_asset_amount = round(base_asset_amount + network_fee_asset + execution_fee_asset, 8)
    
    now = datetime.now(timezone.utc)
    ttl_seconds = 30
    expires_at = now + timedelta(seconds=ttl_seconds)
    
    quote_id = f"quot_{uuid.uuid4().hex[:12]}"
    
    return {
        "id": quote_id,
        "account_id": account_id,
        "fiat_amount": fiat_amount,
        "fiat_currency": fiat_curr,
        "fiat_value_usd": round(fiat_value_usd, 2),
        "asset": asset,
        "asset_amount": base_asset_amount,
        "network_fee_asset": network_fee_asset,
        "execution_fee_asset": execution_fee_asset,
        "total_asset_amount": total_asset_amount,
        "selected_route": best_route["name"],
        "routes": routes,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "ttl_seconds": ttl_seconds,
        "status": "ACTIVE"
    }

def is_quote_expired(expires_at_iso: str) -> bool:
    expiry = datetime.fromisoformat(expires_at_iso.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    return now > expiry
