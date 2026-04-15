#!/usr/bin/env bash
# =============================================================================
# setup.sh — One-shot startup for Smart Dispute & Refund Orchestrator
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[setup]${NC} $*"; }
warn()    { echo -e "${YELLOW}[setup]${NC} $*"; }
error()   { echo -e "${RED}[setup]${NC} $*" >&2; exit 1; }

# ── 1. Copy .env.example if .env is missing ──────────────────────────────────
if [ ! -f ".env" ]; then
  warn ".env not found — copying from .env.example"
  cp .env.example .env
  warn "👉  Edit .env and set DB_PASSWORD before continuing."
  warn "    Press ENTER when ready or Ctrl+C to abort."
  read -r
fi

# shellcheck source=.env
set -a; source .env; set +a

if [ -z "${DB_PASSWORD:-}" ]; then
  error "DB_PASSWORD is not set in .env. Aborting."
fi

# ── 2. Start Oracle ───────────────────────────────────────────────────────────
info "Starting Oracle container…"
docker compose up -d oracle

# ── 3. Wait for Oracle to be healthy ─────────────────────────────────────────
info "Waiting for Oracle to be healthy (this can take 1-3 minutes on first boot)…"
MAX_WAIT=180
ELAPSED=0
INTERVAL=10

while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' dispute_oracle 2>/dev/null || echo "not_found")

  if [ "$STATUS" = "healthy" ]; then
    info "Oracle is healthy ✓"
    break
  fi

  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    error "Oracle did not become healthy within ${MAX_WAIT}s. Check: docker logs dispute_oracle"
  fi

  warn "Oracle status: ${STATUS} — waiting ${INTERVAL}s… (${ELAPSED}/${MAX_WAIT}s)"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

# Extra wait to ensure listener is fully ready
sleep 5

# ── 4. Start backend + frontend ───────────────────────────────────────────────
info "Starting backend and frontend containers…"
docker compose up -d backend frontend

info "Waiting for backend to start…"
sleep 8

# ── 5. Quick health check ─────────────────────────────────────────────────────
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/health/db" || echo "000")
if [ "$HEALTH" = "200" ]; then
  info "Backend health check passed ✓"
else
  warn "Backend health check returned HTTP ${HEALTH} — it may still be starting up."
fi

# ── 6. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🚀 Dispute Orchestrator is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  API  →  ${YELLOW}http://localhost:3000${NC}"
echo -e "  UI   →  ${YELLOW}http://localhost:5173${NC}"
echo -e "  Docs →  ${YELLOW}backend/openapi.yaml${NC}"
echo ""
echo -e "  Seed TXN IDs to test: 1 (Swiggy), 2 (Amazon),"
echo -e "                         3 (Zomato), 4 (Flipkart), 5 (PayTM/REVERSED)"
echo ""
echo -e "  Run API tests: ${YELLOW}node tests/test_api.js${NC}"
echo -e "  View logs:     ${YELLOW}docker compose logs -f backend${NC}"
echo ""
