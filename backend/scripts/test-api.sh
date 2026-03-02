#!/usr/bin/env bash
# ============================================================
# test-api.sh — Smoke-test every backend API endpoint
# Usage: bash scripts/test-api.sh
#
# Optional env vars:
#   STEAM_ID=<your_steam_id>   — also test user-specific endpoints
#   API_BASE=http://...        — override base URL (default localhost:3000)
# ============================================================

set -uo pipefail

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

API_BASE="${API_BASE:-http://localhost:3000}"
PASSED=0
FAILED=0
SKIPPED=0

# ── Helpers ─────────────────────────────────────────────────
# test_endpoint <METHOD> <PATH> [BODY]
# Prints pass/fail with status code and response time
test_endpoint() {
  local method="$1"
  local endpoint="$2"
  local body="${3:-}"
  local url="${API_BASE}${endpoint}"
  local label="${method} ${endpoint}"

  local curl_args=(-s -o /tmp/pse_api_response.json -w '%{http_code} %{time_total}')

  if [[ "$method" == "POST" ]]; then
    curl_args+=(-X POST -H "Content-Type: application/json" -d "$body")
  fi

  local result
  result=$(curl "${curl_args[@]}" "$url" 2>/dev/null) || true

  local status_code="${result%% *}"
  local time_secs="${result##* }"
  local time_ms
  time_ms=$(echo "$time_secs" | awk '{printf "%.0f", $1 * 1000}')

  if [[ "$status_code" =~ ^2 ]]; then
    echo -e "  ${GREEN}✅ ${label}${NC}  ${DIM}${status_code} · ${time_ms}ms${NC}"
    PASSED=$((PASSED + 1))
  elif [[ "$status_code" == "000" ]]; then
    echo -e "  ${RED}❌ ${label}${NC}  ${DIM}connection refused${NC}"
    FAILED=$((FAILED + 1))
  else
    echo -e "  ${RED}❌ ${label}${NC}  ${DIM}${status_code} · ${time_ms}ms${NC}"
    # Show error body for debugging
    local err_body
    err_body=$(cat /tmp/pse_api_response.json 2>/dev/null | head -c 120)
    [[ -n "$err_body" ]] && echo -e "       ${DIM}${err_body}${NC}"
    FAILED=$((FAILED + 1))
  fi
}

skip_endpoint() {
  local label="$1"
  local reason="$2"
  echo -e "  ${YELLOW}⏭  ${label}${NC}  ${DIM}${reason}${NC}"
  SKIPPED=$((SKIPPED + 1))
}

# ── Banner ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  API Smoke Tests${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "  Target: ${CYAN}${API_BASE}${NC}"
echo ""

# ── Pre-flight: is the server up? ───────────────────────────
echo -e "${BOLD}[Pre-flight]${NC}"
if curl -s --max-time 3 "${API_BASE}/api/health" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Server is reachable${NC}"
else
  echo -e "  ${RED}❌ Server is NOT reachable at ${API_BASE}${NC}"
  echo -e "  ${YELLOW}   Start it first:  npm run dev${NC}"
  echo ""
  exit 1
fi
echo ""

# ── Core Endpoints ──────────────────────────────────────────
echo -e "${BOLD}[Core]${NC}"
test_endpoint GET "/api/health"
echo ""

# ── Game Endpoints ──────────────────────────────────────────
echo -e "${BOLD}[Game Details — Steam Store API]${NC}"
test_endpoint GET "/api/game/730"
echo ""

# ── Recommendation Endpoints ───────────────────────────────
echo -e "${BOLD}[Recommendation Engine]${NC}"
test_endpoint GET  "/api/recommend/status"
test_endpoint GET  "/api/recommend/similar/730?limit=5"
test_endpoint POST "/api/recommend/bytags" '{"tags":["action","fps"],"limit":5}'
echo ""

# ── User Endpoints (require Steam ID) ──────────────────────
echo -e "${BOLD}[User Endpoints — Steam Web API]${NC}"
if [[ -n "${STEAM_ID:-}" ]]; then
  test_endpoint GET "/api/user/${STEAM_ID}/profile"
  test_endpoint GET "/api/user/${STEAM_ID}/library"
  test_endpoint GET "/api/user/${STEAM_ID}/recent"
  echo ""
  echo -e "${BOLD}[Personalized Recommendations]${NC}"
  test_endpoint GET "/api/recommend/user/${STEAM_ID}?limit=5"
else
  skip_endpoint "GET /api/user/:steamId/profile"  "set STEAM_ID to test"
  skip_endpoint "GET /api/user/:steamId/library"   "set STEAM_ID to test"
  skip_endpoint "GET /api/user/:steamId/recent"    "set STEAM_ID to test"
  skip_endpoint "GET /api/recommend/user/:steamId"  "set STEAM_ID to test"
fi
echo ""

# ── Search Endpoint ──────────────────────────────────────────
echo -e "${BOLD}[Search Query — search.routes.ts]${NC}"
test_endpoint GET "/api/search?genres=RPG"
echo ""

# ── Summary ─────────────────────────────────────────────────
TOTAL=$((PASSED + FAILED))
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: ${PASSED}${NC}  ${RED}Failed: ${FAILED}${NC}  ${YELLOW}Skipped: ${SKIPPED}${NC}  (${TOTAL} run)"

if [[ "$FAILED" -eq 0 ]]; then
  echo -e "  ${GREEN}All tests passed ✅${NC}"
else
  echo -e "  ${RED}${FAILED} test(s) failed ❌${NC}"
fi
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

# Clean up
rm -f /tmp/pse_api_response.json

exit "$FAILED"
