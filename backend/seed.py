import uuid
from datetime import datetime, timezone, timedelta
from backend.db import init_db, get_connection

def seed_database():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    # Clear existing data to ensure clean seed
    for table in ["transactions", "payments", "quotes", "cards", "accounts", "api_keys", "webhooks", "webhook_logs"]:
        cursor.execute(f"DELETE FROM {table}")

    now = datetime.now(timezone.utc)
    demo_account_id = "acc_spendbtc_demo"

    # 1. Primary User Account (PRD Section 15: Available to spend $1,284.62, BTC 0.018, sBTC 0.006)
    cursor.execute("""
    INSERT INTO accounts (id, user_name, stacks_address, btc_balance, sbtc_balance, fiat_currency, spending_limit_fiat, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        demo_account_id,
        "Vittorio Affolabi",
        "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        0.01800000,
        0.00600000,
        "USD",
        5000.0,
        now.isoformat()
    ))

    # 2. Virtual Card Prototype (PRD Section 10)
    cursor.execute("""
    INSERT INTO cards (id, account_id, card_number, cardholder_name, expiry, cvv, is_frozen, daily_limit_usd, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "card_01h8spendbtc",
        demo_account_id,
        "4532 8920 1823 4901",
        "VITTORIO AFFOLABI",
        "09/28",
        "738",
        0,
        500.0,
        now.isoformat()
    ))

    # 3. Seed Transactions (PRD Section 15: ₦50,000 Completed, ₦12,500 Completed, ₦80,000 Processing)
    txs = [
        {
            "id": "tx_demo_001",
            "amount": 0.00042000,
            "fiat_value": 50000.0,
            "fiat_currency": "NGN",
            "recipient": "Shopify Merchant Hub",
            "route": "Route C (Lightning Relayer)",
            "fees_asset": 0.00000200,
            "status": "COMPLETED",
            "tx_hash": "0x4a9b2c8d1e3f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b",
            "time_offset": timedelta(minutes=45)
        },
        {
            "id": "tx_demo_002",
            "amount": 0.00010500,
            "fiat_value": 12500.0,
            "fiat_currency": "NGN",
            "recipient": "Uber Rides Lagos",
            "route": "Route B (Bitflow DEX)",
            "fees_asset": 0.00000150,
            "status": "COMPLETED",
            "tx_hash": "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
            "time_offset": timedelta(hours=3)
        },
        {
            "id": "tx_demo_003",
            "amount": 0.00067200,
            "fiat_value": 80000.0,
            "fiat_currency": "NGN",
            "recipient": "Apple Store Pay",
            "route": "Route C (Lightning Relayer)",
            "fees_asset": 0.00000250,
            "status": "PROCESSING",
            "tx_hash": "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
            "time_offset": timedelta(minutes=5)
        }
    ]

    for tx in txs:
        t_time = (now - tx["time_offset"]).isoformat()
        cursor.execute("""
        INSERT INTO transactions (id, account_id, asset, amount, fiat_value, fiat_currency, recipient, route, fees_asset, status, tx_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tx["id"], demo_account_id, "sBTC", tx["amount"], tx["fiat_value"], tx["fiat_currency"],
            tx["recipient"], tx["route"], tx["fees_asset"], tx["status"], tx["tx_hash"], t_time, t_time
        ))

    # 4. Default API Keys (PRD Section 16)
    cursor.execute("""
    INSERT INTO api_keys (id, partner_name, key_type, secret_key, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
    """, ("key_demo_test", "Fintech Partner Sandbox", "test", "spbtc_test_8f29d71c90a14e9e", now.isoformat(), 1))

    cursor.execute("""
    INSERT INTO api_keys (id, partner_name, key_type, secret_key, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
    """, ("key_demo_live", "Fintech Partner Production", "live", "spbtc_live_3c17b5e40a8d6f21", now.isoformat(), 1))

    # 5. Default Webhook
    wh_id = "wh_demo_fintech"
    cursor.execute("""
    INSERT INTO webhooks (id, partner_id, url, secret, events, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (wh_id, "acc_spendbtc_demo", "https://api.partner-fintech.com/webhooks/spendbtc", "whsec_98a7f6b5c4d3e2a1", "*", 1, now.isoformat()))

    # Sample webhook delivery log
    cursor.execute("""
    INSERT INTO webhook_logs (id, webhook_id, event, payload_json, status_code, response_body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        "whlog_init_01",
        wh_id,
        "payment.confirmed",
        '{"event":"payment.confirmed","data":{"payment_id":"pay_demo_001","amount":50000,"currency":"NGN","asset_amount":0.00042,"status":"CONFIRMED"}}',
        200,
        '{"status":"acknowledged"}',
        (now - timedelta(minutes=45)).isoformat()
    ))

    conn.commit()
    conn.close()
    print("Database seeded successfully with demo account, cards, transactions, and developer credentials.")

if __name__ == "__main__":
    seed_database()
