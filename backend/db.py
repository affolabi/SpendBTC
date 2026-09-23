import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "spendbtc.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Accounts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        stacks_address TEXT NOT NULL,
        btc_balance REAL NOT NULL DEFAULT 0.0,
        sbtc_balance REAL NOT NULL DEFAULT 0.0,
        fiat_currency TEXT NOT NULL DEFAULT 'USD',
        spending_limit_fiat REAL NOT NULL DEFAULT 5000.0,
        created_at TEXT NOT NULL
    );
    """)

    # Virtual Cards table (PRD Section 10)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        card_number TEXT NOT NULL,
        cardholder_name TEXT NOT NULL,
        expiry TEXT NOT NULL,
        cvv TEXT NOT NULL,
        is_frozen INTEGER NOT NULL DEFAULT 0,
        daily_limit_usd REAL NOT NULL DEFAULT 500.0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    """)

    # Quotes table (PRD Section 8.2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        fiat_amount REAL NOT NULL,
        fiat_currency TEXT NOT NULL,
        asset TEXT NOT NULL,
        asset_amount REAL NOT NULL,
        network_fee_asset REAL NOT NULL,
        execution_fee_asset REAL NOT NULL,
        total_asset_amount REAL NOT NULL,
        selected_route TEXT NOT NULL,
        routes_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
    """)

    # Payments table (PRD Section 8.5)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        quote_id TEXT,
        fiat_amount REAL NOT NULL,
        fiat_currency TEXT NOT NULL,
        asset TEXT NOT NULL,
        asset_amount REAL NOT NULL,
        recipient TEXT NOT NULL,
        route TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUOTED',
        tx_hash TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    """)

    # Transaction Ledger (PRD Section 8.6)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        payment_id TEXT,
        account_id TEXT NOT NULL,
        asset TEXT NOT NULL,
        amount REAL NOT NULL,
        fiat_value REAL NOT NULL,
        fiat_currency TEXT NOT NULL,
        recipient TEXT NOT NULL,
        route TEXT NOT NULL,
        fees_asset REAL NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
    """)

    # API Keys (PRD Section 16)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        partner_name TEXT NOT NULL,
        key_type TEXT NOT NULL, -- 'test' or 'live'
        secret_key TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
    );
    """)

    # Webhooks & Delivery Logs (PRD Section 12 & 16)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        events TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        event TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_body TEXT,
        created_at TEXT NOT NULL
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
