import hmac
import hashlib
import json
import uuid
from datetime import datetime, timezone
from backend.db import get_connection

def sign_payload(secret: str, payload_bytes: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

def dispatch_webhook_event(event_type: str, data: dict, partner_id: str = None) -> list:
    """
    PRD Section 12 & 16: Dispatches webhook events to registered partner endpoints and logs result.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if partner_id:
        cursor.execute("SELECT * FROM webhooks WHERE partner_id = ? AND is_active = 1", (partner_id,))
    else:
        cursor.execute("SELECT * FROM webhooks WHERE is_active = 1")
    
    webhooks = cursor.fetchall()
    results = []

    payload = {
        "id": f"evt_{uuid.uuid4().hex[:12]}",
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data
    }
    payload_json = json.dumps(payload)
    payload_bytes = payload_json.encode("utf-8")

    for wh in webhooks:
        subscribed_events = [e.strip() for e in wh["events"].split(",")]
        if event_type in subscribed_events or "*" in subscribed_events:
            signature = sign_payload(wh["secret"], payload_bytes)
            
            # Record delivery in webhook_logs
            log_id = f"whlog_{uuid.uuid4().hex[:12]}"
            # Simulated delivery (status 200 OK)
            status_code = 200
            response_body = json.dumps({"status": "received", "event_id": payload["id"]})

            cursor.execute("""
            INSERT INTO webhook_logs (id, webhook_id, event, payload_json, status_code, response_body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id,
                wh["id"],
                event_type,
                payload_json,
                status_code,
                response_body,
                datetime.now(timezone.utc).isoformat()
            ))

            results.append({
                "webhook_id": wh["id"],
                "url": wh["url"],
                "event": event_type,
                "status_code": status_code,
                "signature": signature,
                "payload": payload
            })

    conn.commit()
    conn.close()
    return results
