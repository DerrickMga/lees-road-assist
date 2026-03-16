#!/usr/bin/env bash
# ============================================================
#  Lee's Road Assist — Start WhatsApp Webhook + Cloudflare Tunnel
#  Usage:  bash start_whatsapp.sh
#  Deps:   uvicorn (homebrew python3.11), cloudflared
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8001
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# Use the homebrew-managed uvicorn/python (has fastapi, httpx, etc.)
UVICORN=/opt/homebrew/bin/uvicorn

# ── Optional: load .env if present ──────────────────────────────────────────
# Use a safe line-by-line approach so tokens with special chars are handled
if [ -f "$SCRIPT_DIR/.env" ]; then
  while IFS='=' read -r key value; do
    # Skip blank lines and comments
    [[ -z "$key" || "$key" == \#* ]] && continue
    # Strip inline comments and surrounding quotes from the value
    value="${value%%#*}"
    value="${value%"}"}"
    value="${value#"}"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  done < "$SCRIPT_DIR/.env"
  echo "✅  Loaded .env"
fi

# ── Kill any process already on port 8001 ────────────────────────────────────
kill $(lsof -ti :$PORT) 2>/dev/null && echo "🔄  Cleared port $PORT" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀  Starting WhatsApp Bot on port $PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"

# ── Start uvicorn in background ──────────────────────────────────────────────
$UVICORN whatsapp_webhook:app --host 0.0.0.0 --port $PORT \
  --log-level info 2>&1 | tee "$LOG_DIR/webhook.log" &
UVICORN_PID=$!

# Give uvicorn a moment to start
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐  Starting Cloudflare Tunnel → http://localhost:$PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ⏳  Waiting for tunnel URL (can take ~10 seconds)…"
echo ""

# Start cloudflared, capture output, extract the HTTPS URL
cloudflared tunnel --url http://localhost:$PORT 2>&1 | tee "$LOG_DIR/tunnel.log" | while IFS= read -r line; do
  echo "$line"
  # Look for the generated trycloudflare URL
  if echo "$line" | grep -qE "https://[a-z0-9-]+\.trycloudflare\.com"; then
    TUNNEL_URL=$(echo "$line" | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com")
    echo ""
    echo "┌──────────────────────────────────────────────────────────────────┐"
    echo "│                                                                  │"
    echo "│  ✅  TUNNEL READY — paste this into Safenet WABA dashboard:      │"
    echo "│                                                                  │"
    echo "│  Webhook URL:    ${TUNNEL_URL}/webhook"
    echo "│  Verify Token:   ${WHATSAPP_VERIFY_TOKEN:-WL7LELgtIm20L3ZeflNA7kOF4f74zM6E}"
    echo "│                                                                  │"
    echo "│  📖 Docs:        ${TUNNEL_URL}/docs                              │"
    echo "│  ❤️‍🔥 Health:      ${TUNNEL_URL}/health                            │"
    echo "│                                                                  │"
    echo "│  ── WABA Flows (set in backend/.env) ────────────────────────── │"
    echo "│                                                                  │"
    echo "│  WHATSAPP_FLOW_ENDPOINT_URL=${TUNNEL_URL}/flow-endpoint"
    echo "│  WHATSAPP_WABA_ID=<your WABA ID>                                 │"
    echo "│  WHATSAPP_CUSTOMER_FLOW_ID=<run scripts/upload_flows.py>         │"
    echo "│  WHATSAPP_PROVIDER_FLOW_ID=<run scripts/upload_flows.py>         │"
    echo "│                                                                  │"
    echo "│  ℹ️  Notify Provider: POST ${TUNNEL_URL}/notify-provider          │"
    echo "│                                                                  │"
    echo "└──────────────────────────────────────────────────────────────────┘"
    echo ""
  fi
done

# When cloudflared exits, clean up uvicorn
kill $UVICORN_PID 2>/dev/null || true
