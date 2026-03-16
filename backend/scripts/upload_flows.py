#!/usr/bin/env python3
"""
upload_flows.py — Upload and publish WhatsApp Flow JSONs to Meta WABA API.

Usage:
    cd backend/scripts
    python upload_flows.py

Required environment variables (or .env in backend/):
    WHATSAPP_ACCESS_TOKEN   — long-lived or system user token with flows write permission
    WHATSAPP_WABA_ID        — your WhatsApp Business Account ID (numeric)

Optional:
    WHATSAPP_GRAPH_API_URL  — default https://graph.facebook.com/v21.0

The script will:
  1. Create each Flow in WABA (or reuse existing by name)
  2. Upload the flow JSON asset
  3. Validate (print any errors returned by Meta)
  4. Ask for confirmation, then publish

After publishing, it prints the flow IDs you need to add to your .env:
    WHATSAPP_CUSTOMER_FLOW_ID=<id>
    WHATSAPP_PROVIDER_FLOW_ID=<id>
"""

import json
import os
import sys
import pathlib
import httpx
from typing import Optional

# ── Load .env from backend/ if python-dotenv is available ────────────────────
try:
    from dotenv import load_dotenv                         # type: ignore
    env_file = pathlib.Path(__file__).parent.parent / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded env from {env_file}")
except ImportError:
    pass

ACCESS_TOKEN    = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WABA_ID         = os.getenv("WHATSAPP_WABA_ID", "")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "849263908263815")
GRAPH_URL       = os.getenv("WHATSAPP_GRAPH_API_URL", "https://graph.facebook.com/v21.0").rstrip("/")

FLOWS_DIR  = pathlib.Path(__file__).parent.parent / "whatsapp_flows"
KEY_FILE   = pathlib.Path(__file__).parent.parent / "whatsapp_flows" / "flows_private_key.pem"
PUBKEY_FILE = pathlib.Path(__file__).parent.parent / "whatsapp_flows" / "flows_public_key.pem"

FLOWS_TO_UPLOAD = [
    {
        "name":     "Lee's Road Assist — Customer Request",
        "category": "CUSTOMER_SUPPORT",
        "json_file": FLOWS_DIR / "customer_request_flow.json",
        "env_key":   "WHATSAPP_CUSTOMER_FLOW_ID",
    },
    {
        "name":     "Lee's Road Assist — Provider Job Response",
        "category": "CUSTOMER_SUPPORT",
        "json_file": FLOWS_DIR / "provider_job_flow.json",
        "env_key":   "WHATSAPP_PROVIDER_FLOW_ID",
    },
]


def die(msg: str, status: int = 1) -> None:
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(status)


def check_env() -> None:
    if not ACCESS_TOKEN:
        die("WHATSAPP_ACCESS_TOKEN is not set. Generate a token with 'whatsapp_business_messaging' + 'whatsapp_business_management' scopes.")
    if not WABA_ID:
        die("WHATSAPP_WABA_ID is not set. Find it in Meta Business Suite → Account Info.")


def headers() -> dict:
    return {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type":  "application/json",
    }


def ensure_business_encryption_key() -> None:
    """
    WhatsApp Flows (v6.0) require the phone number to have a registered
    public key before flows can be published. This function:
      1. Generates an RSA-2048 key pair (once — reuses if files exist)
      2. Uploads the public key PEM to /{PHONE_NUMBER_ID}/whatsapp_business_encryption

    Keys are saved to whatsapp_flows/flows_private_key.pem  (keep secret!)
    and            whatsapp_flows/flows_public_key.pem
    """
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend

    # 1. Generate or load key pair
    if KEY_FILE.exists() and PUBKEY_FILE.exists():
        print("   🔑 Using existing RSA key pair.")
        pub_pem = PUBKEY_FILE.read_text().strip()
    else:
        print("   🔑 Generating new RSA-2048 key pair for Flow encryption…")
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        pub_key = private_key.public_key()

        KEY_FILE.write_bytes(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        pub_pem_bytes = pub_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        PUBKEY_FILE.write_bytes(pub_pem_bytes)
        pub_pem = pub_pem_bytes.decode()
        print(f"   Saved keys to {KEY_FILE.parent}/")

    # 2. Upload public key to Meta
    print("   Uploading public key to Meta…")
    resp = httpx.post(
        f"{GRAPH_URL}/{PHONE_NUMBER_ID}/whatsapp_business_encryption",
        headers=headers(),
        json={"business_public_key": pub_pem},
        timeout=30.0,
    )
    data = resp.json()
    if resp.status_code not in (200, 201) or not data.get("success"):
        # 'already_set' is fine — just means the key was already registered
        err_msg = data.get("error", {}).get("message", "")
        if "already" in err_msg.lower() or data.get("success") is True:
            print("   Public key already registered — skipping.")
        else:
            print(f"   ⚠️  Key upload response: {data}")
            print("   Continuing — publish may fail if key is not accepted.")
    else:
        print("   ✅ Public key registered successfully.")


def list_existing_flows() -> dict[str, str]:
    """Return {name: flow_id, name__status: status} for all flows in this WABA."""
    resp = httpx.get(
        f"{GRAPH_URL}/{WABA_ID}/flows",
        params={"fields": "id,name,status"},
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
        timeout=30.0,
    )
    if resp.status_code != 200:
        print(f"⚠️  Could not list existing flows: {resp.text}")
        return {}
    result: dict[str, str] = {}
    for f in resp.json().get("data", []):
        result[f["name"]] = f["id"]
        result[f"{f['name']}__status"] = f.get("status", "UNKNOWN")
    return result


def create_flow(name: str, category: str) -> str:
    """Create a flow and return its ID."""
    resp = httpx.post(
        f"{GRAPH_URL}/{WABA_ID}/flows",
        headers=headers(),
        json={"name": name, "categories": [category]},
    )
    data = resp.json()
    if resp.status_code not in (200, 201) or "id" not in data:
        die(f"Failed to create flow '{name}': {data}")
    flow_id: str = data["id"]
    print(f"   Created flow '{name}' → id={flow_id}")
    return flow_id


def upload_flow_json(flow_id: str, json_file: pathlib.Path) -> None:
    """Upload the flow JSON as an asset (multipart form)."""
    with open(json_file, "rb") as fh:
        resp = httpx.post(
            f"{GRAPH_URL}/{flow_id}/assets",
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
            files={"file": (json_file.name, fh, "application/json")},
            data={"name": "flow.json", "asset_type": "FLOW_JSON"},
            timeout=60.0,
        )
    data = resp.json()
    if resp.status_code not in (200, 201) or not data.get("success"):
        die(f"Failed to upload asset for flow {flow_id}: {data}")
    print(f"   Uploaded {json_file.name} → flow {flow_id}")


def validate_flow(flow_id: str) -> list:
    """Return a list of validation error strings (empty means valid)."""
    resp = httpx.get(
        f"{GRAPH_URL}/{flow_id}",
        params={"fields": "validation_errors,status"},
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
    )
    data = resp.json()
    errors: list = data.get("validation_errors", [])
    return errors


def publish_flow(flow_id: str) -> None:
    """Publish a DRAFT flow."""
    resp = httpx.post(
        f"{GRAPH_URL}/{flow_id}/publish",
        headers=headers(),
        timeout=30.0,
    )
    data = resp.json()
    if not data.get("success"):
        die(f"Failed to publish flow {flow_id}: {data}")
    print(f"   ✅ Published flow {flow_id}")


def clear_flow_endpoint(flow_id: str) -> None:
    """
    Remove any registered endpoint_uri from the flow.

    Our flows use v6.1 with only 'navigate' / 'complete' actions — no
    data_exchange — so they don't need a live endpoint. If we previously
    registered one, Meta will health-check it on every publish attempt.
    Clearing it here prevents that check and allows immediate publish.
    """
    resp = httpx.post(
        f"{GRAPH_URL}/{flow_id}",
        headers=headers(),
        json={"endpoint_uri": ""},
        timeout=30.0,
    )
    data = resp.json()
    if resp.status_code == 200 and data.get("success"):
        print("   Cleared endpoint_uri (no server endpoint required for this flow).")
    else:
        # Might already be empty — not fatal
        err = data.get("error", {}).get("message", str(data))
        print(f"   ℹ️  endpoint_uri clear: {err} (continuing)")


def process_flow(meta: dict, existing: dict[str, str]) -> Optional[str]:
    name      = meta["name"]
    category  = meta["category"]
    json_file = meta["json_file"]

    if not json_file.exists():
        print(f"⚠️  Skipping '{name}': {json_file} not found")
        return None

    print(f"\n── {name} ──")

    # Reuse existing flow if it was already created
    if name in existing:
        flow_id = existing[name]
        status  = existing.get(f"{name}__status", "UNKNOWN")
        print(f"   Found existing flow → id={flow_id}  status={status}")
        # Already published — don't re-upload
        if status == "PUBLISHED":
            print("   Already published — skipping upload/publish.")
            return flow_id
    else:
        flow_id = create_flow(name, category)

    upload_flow_json(flow_id, json_file)

    print("   Validating…")
    errors = validate_flow(flow_id)
    if errors:
        print(f"   ❌  Validation errors ({len(errors)}) — cannot publish:")
        for e in errors:
            msg = e.get("message", e) if isinstance(e, dict) else e
            print(f"      • {msg}")
        print("   Fix the flow JSON and re-run.")
        return flow_id   # Return ID so it can be written to .env even if not published

    print("   ✅ No validation errors.")

    # v6.1 flows with only navigate/complete actions don't need an endpoint.
    # Clear any previously registered endpoint_uri so Meta won't health-check it.
    print("   Clearing endpoint_uri (v6.1 — no endpoint required)…")
    clear_flow_endpoint(flow_id)

    print(f"   Publishing '{name}'…")
    publish_flow(flow_id)
    return flow_id


def main() -> None:
    print("═" * 60)
    print("  Lee's Road Assist — WhatsApp Flows Uploader")
    print(f"  WABA ID       : {WABA_ID}")
    print(f"  Phone No. ID  : {PHONE_NUMBER_ID}")
    print(f"  Graph         : {GRAPH_URL}")
    print("═" * 60)

    check_env()

    # Step 0: Ensure the phone number has a registered public key so flows can publish
    print("\n── Step 0: Business Encryption Key ──────────────────────────────")
    ensure_business_encryption_key()

    print("\nFetching existing flows from WABA…")
    existing = list_existing_flows()
    flow_names = [k for k in existing.keys() if not k.endswith("__status")]
    if flow_names:
        print(f"  Found {len(flow_names)} existing flow(s): {flow_names}")

    results: dict[str, str] = {}
    for meta in FLOWS_TO_UPLOAD:
        flow_id = process_flow(meta, existing)
        if flow_id:
            results[meta["env_key"]] = flow_id

    if results:
        print("\n" + "═" * 60)
        print("  Add these to backend/.env:")
        print("─" * 60)
        for env_key, flow_id in results.items():
            print(f"  {env_key}={flow_id}")
        print("═" * 60)

    # Also remind about the flow endpoint
    print("\n  Don't forget to set:")
    print("  WHATSAPP_FLOW_ENDPOINT_URL=https://<your-tunnel>/flow-endpoint")
    print("  WHATSAPP_WABA_ID=" + WABA_ID)
    print("\n  Then restart the WhatsApp bot server.\n")


if __name__ == "__main__":
    main()
