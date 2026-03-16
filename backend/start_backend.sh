#!/usr/bin/env bash
# ============================================================
#  Lee's Road Assist — Start FastAPI Backend (port 8000)
#  Usage:  bash start_backend.sh
#  Deps:   uvicorn, python3.11 (homebrew), postgres, redis
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8000
UVICORN=/opt/homebrew/bin/uvicorn

# ── Load .env if present ─────────────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    value="${value%%#*}"
    value="${value%"}"}"
    value="${value#"}"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  done < "$SCRIPT_DIR/.env"
  echo "✅  Loaded .env"
fi

# ── Kill any existing process on port 8000 ───────────────────────────────────
kill $(lsof -ti :$PORT) 2>/dev/null && echo "🔄  Cleared port $PORT" || true
sleep 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀  Starting Backend API on port $PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  API Docs: http://localhost:$PORT/docs"
echo "  Health:   http://localhost:$PORT/health"
echo ""

cd "$SCRIPT_DIR"
$UVICORN app.main:app --host 0.0.0.0 --port $PORT --reload --log-level info 2>&1 | tee /tmp/backend.log
