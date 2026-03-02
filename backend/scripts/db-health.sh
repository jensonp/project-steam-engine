#!/usr/bin/env bash
# ============================================================
# db-health.sh — Verify PostgreSQL connection & data integrity
# Usage: bash scripts/db-health.sh
# ============================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "  ${CYAN}ℹ  $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠  $1${NC}"; }

FAILURES=0

# ── Load .env ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
  info "Loaded env from $ENV_FILE"
else
  warn ".env not found at $ENV_FILE — using defaults"
fi

PGHOST="${PGHOST:-localhost}"
PGDATABASE="${PGDATABASE:-steam_collab}"
PGUSER="${PGUSER:-postgres}"
PGPORT="${PGPORT:-5432}"

echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Database Health Check${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "  Host: ${CYAN}${PGHOST}:${PGPORT}${NC}  DB: ${CYAN}${PGDATABASE}${NC}  User: ${CYAN}${PGUSER}${NC}"
echo ""

# ── 1. pg_isready ───────────────────────────────────────────
echo -e "${BOLD}[1/4] PostgreSQL connectivity${NC}"
if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q 2>/dev/null; then
  pass "PostgreSQL is accepting connections"
else
  fail "PostgreSQL is NOT reachable (is it running?)"
  echo ""
  echo -e "${RED}Cannot continue — database is offline.${NC}"
  exit 1
fi

# Helper to run a query and capture output
run_query() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
       -t -A -c "$1" 2>/dev/null
}

# ── 2. Table existence & row count ──────────────────────────
echo ""
echo -e "${BOLD}[2/4] Games table${NC}"
TABLE_EXISTS=$(run_query "SELECT to_regclass('public.games');" || echo "")
if [[ "$TABLE_EXISTS" == "games" ]]; then
  pass "Table 'games' exists"
else
  fail "Table 'games' does not exist — run games_to_db.py first"
  echo ""
  exit 1
fi

ROW_COUNT=$(run_query "SELECT COUNT(*) FROM games;")
if [[ "$ROW_COUNT" -gt 0 ]]; then
  pass "Row count: ${ROW_COUNT} games loaded"
else
  fail "Table 'games' is empty (0 rows)"
fi

FREE_COUNT=$(run_query "SELECT COUNT(*) FROM games WHERE price = 0;")
AVG_PRICE=$(run_query "SELECT ROUND(AVG(price)::numeric, 2) FROM games WHERE price > 0;")
info "Free games: ${FREE_COUNT}  |  Avg paid price: \$${AVG_PRICE:-N/A}"

# ── 3. Top games sanity check ──────────────────────────────
echo ""
echo -e "${BOLD}[3/4] Top 5 games by positive votes${NC}"
TOP_GAMES=$(run_query "
  SELECT game_name || ' (' || positive_votes || ' votes)'
  FROM games
  ORDER BY positive_votes DESC
  LIMIT 5;
")
if [[ -n "$TOP_GAMES" ]]; then
  pass "Data looks sane:"
  echo "$TOP_GAMES" | while IFS= read -r line; do
    echo -e "       ${line}"
  done
else
  fail "Could not retrieve top games"
fi

# ── 4. Indexes ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/4] Indexes${NC}"
INDEX_COUNT=$(run_query "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE tablename = 'games';
")
if [[ "$INDEX_COUNT" -gt 0 ]]; then
  pass "${INDEX_COUNT} index(es) on 'games' table"
  INDEX_LIST=$(run_query "
    SELECT indexname || ' (' || indexdef || ')'
    FROM pg_indexes
    WHERE tablename = 'games'
    LIMIT 5;
  ")
  echo "$INDEX_LIST" | while IFS= read -r line; do
    echo -e "       ${line}"
  done
else
  warn "No indexes found — queries may be slow"
fi

# ── Summary ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "  ${GREEN}All checks passed ✅${NC}"
else
  echo -e "  ${RED}${FAILURES} check(s) failed ❌${NC}"
fi
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

exit "$FAILURES"
