import os
import sys
import json
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.db import init_db, get_connection
from backend.seed import seed_database
from backend.engine.quote import generate_payment_quote, BTC_USD_PRICE
from backend.engine.execution import execute_payment_flow
from backend.engine.risk import RiskValidationError
from backend.engine.webhook import dispatch_webhook_event

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

class SpendBTCHandler(BaseHTTPRequestHandler):

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SpendBTC-Signature")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code: int, data: dict):
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def parse_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(body) if body else {}
        return {}

    def serve_static(self, path: str):
        if path in ["/", "/index.html"]:
            file_path = os.path.join(FRONTEND_DIR, "index.html")
            content_type = "text/html"
        elif path.endswith(".js"):
            file_path = os.path.join(FRONTEND_DIR, os.path.basename(path))
            content_type = "application/javascript"
        elif path.endswith(".css"):
            file_path = os.path.join(FRONTEND_DIR, os.path.basename(path))
            content_type = "text/css"
        else:
            file_path = os.path.join(FRONTEND_DIR, os.path.basename(path))
            content_type = "application/octet-stream"

        if os.path.exists(file_path) and os.path.isfile(file_path):
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_cors_headers()
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_json(404, {"error": "File not found"})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Static assets
        if not path.startswith("/api/"):
            return self.serve_static(path)

        conn = get_connection()
        cursor = conn.cursor()

        # GET /api/v1/accounts
        if path == "/api/v1/accounts":
            cursor.execute("SELECT * FROM accounts LIMIT 1")
            acc = cursor.fetchone()
            if not acc:
                conn.close()
                return self.send_json(404, {"error": "No account found"})
            
            acc_dict = dict(acc)
            # Calculate total spending power in fiat
            sbtc_usd = acc_dict["sbtc_balance"] * BTC_USD_PRICE
            btc_usd = acc_dict["btc_balance"] * BTC_USD_PRICE
            total_usd = round(sbtc_usd + btc_usd, 2)
            acc_dict["total_spending_power_usd"] = total_usd
            conn.close()
            return self.send_json(200, acc_dict)

        # GET /api/v1/accounts/:id/balance
        elif path.startswith("/api/v1/accounts/") and path.endswith("/balance"):
            parts = path.split("/")
            acc_id = parts[4]
            cursor.execute("SELECT * FROM accounts WHERE id = ?", (acc_id,))
            acc = cursor.fetchone()
            if not acc:
                conn.close()
                return self.send_json(404, {"error": "Account not found"})
            acc_dict = dict(acc)
            conn.close()
            return self.send_json(200, {
                "account_id": acc_dict["id"],
                "fiat_currency": acc_dict["fiat_currency"],
                "btc_balance": f"{acc_dict['btc_balance']:.8f}",
                "sbtc_balance": f"{acc_dict['sbtc_balance']:.8f}",
                "available_spending_power_usd": round((acc_dict["sbtc_balance"] + acc_dict["btc_balance"]) * BTC_USD_PRICE, 2),
                "stacks_address": acc_dict["stacks_address"]
            })

        # GET /api/v1/card
        elif path == "/api/v1/card":
            cursor.execute("SELECT * FROM cards LIMIT 1")
            card = cursor.fetchone()
            conn.close()
            if not card:
                return self.send_json(404, {"error": "No card found"})
            return self.send_json(200, dict(card))

        # GET /api/v1/payments/:id (PRD Section 8.7)
        elif path.startswith("/api/v1/payments/") and not path.endswith("/quote"):
            payment_id = path.split("/")[4]
            cursor.execute("SELECT * FROM payments WHERE id = ?", (payment_id,))
            pay = cursor.fetchone()
            conn.close()
            if not pay:
                return self.send_json(404, {"error": "Payment not found"})
            return self.send_json(200, dict(pay))

        # GET /api/v1/transactions/:id (PRD Section 8.7)
        elif path.startswith("/api/v1/transactions/") and len(path.split("/")) > 4:
            tx_id = path.split("/")[4]
            cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
            tx = cursor.fetchone()
            conn.close()
            if not tx:
                return self.send_json(404, {"error": "Transaction not found"})
            return self.send_json(200, dict(tx))

        # GET /api/v1/transactions
        elif path == "/api/v1/transactions":
            cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50")
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return self.send_json(200, rows)

        # GET /api/v1/developer/keys
        elif path == "/api/v1/developer/keys":
            cursor.execute("SELECT id, partner_name, key_type, secret_key, created_at, is_active FROM api_keys")
            keys = [dict(k) for k in cursor.fetchall()]
            conn.close()
            return self.send_json(200, keys)

        # GET /api/v1/developer/webhooks
        elif path == "/api/v1/developer/webhooks":
            cursor.execute("SELECT * FROM webhooks")
            whs = [dict(w) for w in cursor.fetchall()]
            conn.close()
            return self.send_json(200, whs)

        # GET /api/v1/developer/logs
        elif path == "/api/v1/developer/logs":
            cursor.execute("SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 30")
            logs = [dict(l) for l in cursor.fetchall()]
            conn.close()
            return self.send_json(200, logs)

        conn.close()
        self.send_json(404, {"error": f"Path {path} not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            body = self.parse_body()
        except Exception as e:
            return self.send_json(400, {"error": f"Invalid JSON body: {str(e)}"})

        conn = get_connection()
        cursor = conn.cursor()

        # POST /api/v1/accounts (PRD Section 8.7)
        if path == "/api/v1/accounts":
            acc_id = f"acc_{uuid.uuid4().hex[:12]}"
            user_name = body.get("user_name", "Stacks User")
            stacks_address = body.get("stacks_address", "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7")
            btc_balance = float(body.get("btc_balance", 0.0))
            sbtc_balance = float(body.get("sbtc_balance", 0.005))
            fiat_currency = body.get("fiat_currency", "USD")
            now_iso = datetime.now(timezone.utc).isoformat()

            cursor.execute("""
            INSERT INTO accounts (id, user_name, stacks_address, btc_balance, sbtc_balance, fiat_currency, spending_limit_fiat, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 5000.0, ?)
            """, (acc_id, user_name, stacks_address, btc_balance, sbtc_balance, fiat_currency, now_iso))
            conn.commit()
            conn.close()

            return self.send_json(201, {
                "id": acc_id,
                "user_name": user_name,
                "stacks_address": stacks_address,
                "btc_balance": btc_balance,
                "sbtc_balance": sbtc_balance,
                "fiat_currency": fiat_currency,
                "created_at": now_iso
            })

        # POST /api/v1/payments/quote (PRD Section 8.2 & Section 8.7)
        elif path == "/api/v1/payments/quote":
            amount = float(body.get("amount", 50000))
            currency = body.get("currency", "NGN")
            asset = body.get("asset", "sBTC")
            account_id = body.get("account_id", "acc_spendbtc_demo")

            quote = generate_payment_quote(account_id, amount, currency, asset)
            
            # Store quote in database
            cursor.execute("""
            INSERT INTO quotes (id, account_id, fiat_amount, fiat_currency, asset, asset_amount, network_fee_asset, execution_fee_asset, total_asset_amount, selected_route, routes_json, expires_at, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                quote["id"], quote["account_id"], quote["fiat_amount"], quote["fiat_currency"], quote["asset"],
                quote["asset_amount"], quote["network_fee_asset"], quote["execution_fee_asset"], quote["total_asset_amount"],
                quote["selected_route"], json.dumps(quote["routes"]), quote["expires_at"], quote["created_at"], "ACTIVE"
            ))
            conn.commit()
            conn.close()

            # Webhook notification
            dispatch_webhook_event("payment.created", {
                "quote_id": quote["id"],
                "fiat_amount": quote["fiat_amount"],
                "fiat_currency": quote["fiat_currency"],
                "total_asset_amount": quote["total_asset_amount"],
                "expires_at": quote["expires_at"]
            })

            return self.send_json(200, quote)

        # POST /api/v1/payments (PRD Section 8.3 & 8.7)
        elif path == "/api/v1/payments":
            quote_id = body.get("quote_id")
            recipient = body.get("recipient", "Shopify Merchant Hub")
            route = body.get("route")

            if not quote_id:
                conn.close()
                return self.send_json(400, {"error": "Missing quote_id"})

            cursor.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
            q_row = cursor.fetchone()
            if not q_row:
                conn.close()
                return self.send_json(404, {"error": "Quote not found"})

            quote_data = dict(q_row)
            account_id = quote_data["account_id"]
            conn.close()

            try:
                result = execute_payment_flow(account_id, quote_data, recipient, route)
                return self.send_json(200, result)
            except RiskValidationError as rve:
                return self.send_json(422, {"error": rve.message, "code": rve.code})
            except Exception as ex:
                return self.send_json(500, {"error": str(ex)})

        # POST /api/v1/card/freeze (PRD Section 10)
        elif path == "/api/v1/card/freeze":
            is_frozen = 1 if body.get("is_frozen", True) else 0
            cursor.execute("UPDATE cards SET is_frozen = ? WHERE account_id = 'acc_spendbtc_demo'", (is_frozen,))
            conn.commit()
            conn.close()
            return self.send_json(200, {"success": True, "is_frozen": bool(is_frozen)})

        # POST /api/v1/card/charge (Simulate online card purchase)
        elif path == "/api/v1/card/charge":
            cursor.execute("SELECT is_frozen FROM cards WHERE account_id = 'acc_spendbtc_demo'")
            card = cursor.fetchone()
            if card and card["is_frozen"]:
                conn.close()
                return self.send_json(403, {"error": "Card is frozen. Please unfreeze before charging."})
            
            amount_usd = float(body.get("amount", 25.0))
            recipient = body.get("merchant", "Amazon.com Checkout")
            
            # Generate quote in USD
            quote = generate_payment_quote("acc_spendbtc_demo", amount_usd, "USD", "sBTC")
            conn.close()
            try:
                result = execute_payment_flow("acc_spendbtc_demo", quote, recipient)
                return self.send_json(200, result)
            except Exception as e:
                return self.send_json(422, {"error": str(e)})

        # POST /api/v1/developer/keys
        elif path == "/api/v1/developer/keys":
            partner_name = body.get("partner_name", "New Partner")
            key_type = body.get("key_type", "test")
            new_key = f"spbtc_{key_type}_{uuid.uuid4().hex[:16]}"
            new_id = f"key_{uuid.uuid4().hex[:12]}"
            now_iso = datetime.now(timezone.utc).isoformat()
            
            cursor.execute("""
            INSERT INTO api_keys (id, partner_name, key_type, secret_key, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """, (new_id, partner_name, key_type, new_key, now_iso))
            conn.commit()
            conn.close()
            return self.send_json(201, {"id": new_id, "partner_name": partner_name, "key_type": key_type, "secret_key": new_key})

        # POST /api/v1/developer/webhooks/test (Send test ping)
        elif path == "/api/v1/developer/webhooks/test":
            results = dispatch_webhook_event("payment.confirmed", {
                "test": True,
                "payment_id": f"pay_test_{uuid.uuid4().hex[:8]}",
                "amount": 50000,
                "currency": "NGN",
                "status": "CONFIRMED",
                "message": "Ping delivery from SpendBTC developer sandbox"
            })
            conn.close()
            return self.send_json(200, {"success": True, "deliveries": results})

        # POST /api/v1/reset (Reset and re-seed demo data)
        elif path == "/api/v1/reset":
            conn.close()
            seed_database()
            return self.send_json(200, {"success": True, "message": "Demo data reset successfully"})

        conn.close()
        self.send_json(404, {"error": f"Path {path} not found"})

def run_server(port=8000):
    init_db()
    # Check if accounts table is populated, if not seed it
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM accounts")
    if cursor.fetchone()["cnt"] == 0:
        conn.close()
        seed_database()
    else:
        conn.close()

    server_address = ("", port)
    httpd = HTTPServer(server_address, SpendBTCHandler)
    print(f"⚡ SpendBTC Server running at http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
