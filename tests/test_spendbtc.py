import unittest
import os
import sys
import uuid

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.db import init_db, get_connection
from backend.seed import seed_database
from backend.engine.quote import generate_payment_quote, is_quote_expired
from backend.engine.risk import validate_payment_request, RiskValidationError
from backend.engine.execution import execute_payment_flow
from backend.engine.webhook import sign_payload, dispatch_webhook_event

class TestSpendBTC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        seed_database()

    def test_01_account_balance(self):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM accounts WHERE id = 'acc_spendbtc_demo'")
        acc = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(acc)
        self.assertEqual(acc["btc_balance"], 0.018)
        self.assertEqual(acc["sbtc_balance"], 0.006)

    def test_02_quote_engine_calculation(self):
        quote = generate_payment_quote("acc_spendbtc_demo", 50000.0, "NGN", "sBTC")
        
        self.assertIsNotNone(quote["id"])
        self.assertEqual(quote["fiat_amount"], 50000.0)
        self.assertEqual(quote["fiat_currency"], "NGN")
        self.assertEqual(quote["asset"], "sBTC")
        # PRD example: 50,000 NGN ~ 0.00042 sBTC
        self.assertAlmostEqual(quote["asset_amount"], 0.00042, delta=0.00005)
        self.assertEqual(quote["ttl_seconds"], 30)
        self.assertEqual(len(quote["routes"]), 3)
        self.assertTrue(any(r["recommended"] for r in quote["routes"]))

    def test_03_risk_engine_insufficient_balance(self):
        fake_quote = {
            "id": "quot_huge",
            "asset": "sBTC",
            "total_asset_amount": 100.0,
            "fiat_value_usd": 7440000.0,
            "expires_at": "2099-01-01T00:00:00Z"
        }
        fake_account = {
            "sbtc_balance": 0.006,
            "btc_balance": 0.018,
            "spending_limit_fiat": 5000.0
        }
        with self.assertRaises(RiskValidationError) as ctx:
            validate_payment_request(fake_account, fake_quote, "SpendBTC Test Merchant")
        self.assertEqual(ctx.exception.code, "INSUFFICIENT_BALANCE")

    def test_04_risk_engine_quote_expired(self):
        expired_quote = {
            "id": "quot_expired",
            "asset": "sBTC",
            "total_asset_amount": 0.00042,
            "expires_at": "2020-01-01T00:00:00Z"
        }
        fake_account = {
            "sbtc_balance": 1.0,
            "btc_balance": 1.0,
            "spending_limit_fiat": 5000.0
        }
        with self.assertRaises(RiskValidationError) as ctx:
            validate_payment_request(fake_account, expired_quote, "SpendBTC Test Merchant")
        self.assertEqual(ctx.exception.code, "QUOTE_EXPIRED")

    def test_05_execution_and_settlement(self):
        quote = generate_payment_quote("acc_spendbtc_demo", 15000.0, "NGN", "sBTC")
        result = execute_payment_flow("acc_spendbtc_demo", quote, "SpendBTC Test Merchant")

        self.assertIsNotNone(result["payment_id"])
        self.assertIsNotNone(result["tx_hash"])
        self.assertTrue(result["tx_hash"].startswith("0x"))
        self.assertEqual(result["status"], "CONFIRMED")

        # Verify ledger entry
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (result["transaction_id"],))
        tx_row = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(tx_row)
        self.assertEqual(tx_row["recipient"], "SpendBTC Test Merchant")
        self.assertEqual(tx_row["status"], "COMPLETED")

    def test_06_webhook_hmac_signatures(self):
        secret = "test_webhook_secret_key"
        payload = b'{"event":"payment.confirmed","amount":50000}'
        signature = sign_payload(secret, payload)

        self.assertEqual(len(signature), 64)
        self.assertEqual(signature, sign_payload(secret, payload))

    def test_07_account_creation_and_lookup(self):
        new_id = f"acc_test_{uuid.uuid4().hex[:8]}"
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO accounts (id, user_name, stacks_address, btc_balance, sbtc_balance, fiat_currency, spending_limit_fiat, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 5000.0, '2026-09-24T00:00:00Z')
        """, (new_id, "Test Stacks User", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 0.05, 0.02, "USD"))
        conn.commit()

        cursor.execute("SELECT * FROM accounts WHERE id = ?", (new_id,))
        acc = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(acc)
        self.assertEqual(acc["user_name"], "Test Stacks User")
        self.assertEqual(acc["stacks_address"], "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
        self.assertEqual(acc["sbtc_balance"], 0.02)

    def test_08_get_payment_and_transaction_by_id(self):
        quote = generate_payment_quote("acc_spendbtc_demo", 5000.0, "NGN", "sBTC")
        res = execute_payment_flow("acc_spendbtc_demo", quote, "SpendBTC Test Merchant #3")
        payment_id = res["payment_id"]
        tx_id = res["transaction_id"]

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM payments WHERE id = ?", (payment_id,))
        p = cursor.fetchone()
        self.assertIsNotNone(p)
        self.assertEqual(p["status"], "CONFIRMED")

        cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
        t = cursor.fetchone()
        self.assertIsNotNone(t)
        self.assertEqual(t["status"], "COMPLETED")
        conn.close()

if __name__ == "__main__":
    unittest.main()
