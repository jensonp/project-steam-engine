#!/usr/bin/env bash
# ============================================================
# test-all.sh — Run all unit tests for backend and frontend
# Usage: bash scripts/test-all.sh
# ============================================================

set -uo pipefail

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BACKEND_PASS=0
FRONTEND_PASS=0
UI_CHECK_PASS=1
PROD_SMOKE_PASS=1

echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Project Steam Engine — Test Suite${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

# ── Backend Tests ───────────────────────────────────────────
echo -e "${BOLD}[Backend Tests]${NC}"
echo -e "${CYAN}Running Jest tests in backend/...${NC}"
echo ""

cd "$PROJECT_ROOT/backend"
if npm test; then
  BACKEND_PASS=1
  echo -e "${GREEN}✅ Backend tests passed${NC}"
else
  echo -e "${RED}❌ Backend tests failed${NC}"
fi

echo ""

# ── Frontend Tests ──────────────────────────────────────────
echo -e "${BOLD}[Frontend Tests]${NC}"
echo -e "${CYAN}Running Jest tests in frontend/...${NC}"
echo ""

cd "$PROJECT_ROOT/frontend"
if npm test; then
  FRONTEND_PASS=1
  echo -e "${GREEN}✅ Frontend tests passed${NC}"
else
  echo -e "${RED}❌ Frontend tests failed${NC}"
fi

echo ""

# ── Optional Frontend UI Checks (Playwright) ────────────────
if [[ "${RUN_UI_CHECK:-0}" == "1" ]]; then
  echo -e "${BOLD}[Frontend UI Checks]${NC}"
  echo -e "${CYAN}Running Playwright checks in frontend/...${NC}"
  echo ""

  cd "$PROJECT_ROOT/frontend"
  if npm run ui:check; then
    UI_CHECK_PASS=1
    echo -e "${GREEN}✅ Frontend UI checks passed${NC}"
  else
    UI_CHECK_PASS=0
    echo -e "${RED}❌ Frontend UI checks failed${NC}"
  fi

  echo ""
fi

# ── Optional Production Smoke Checks ────────────────────────
if [[ "${RUN_PROD_SMOKE:-0}" == "1" ]]; then
  echo -e "${BOLD}[Production Smoke Checks]${NC}"
  echo -e "${CYAN}Running scripts/smoke-production.sh ...${NC}"
  echo ""

  cd "$PROJECT_ROOT"
  if bash scripts/smoke-production.sh; then
    PROD_SMOKE_PASS=1
    echo -e "${GREEN}✅ Production smoke checks passed${NC}"
  else
    PROD_SMOKE_PASS=0
    echo -e "${RED}❌ Production smoke checks failed${NC}"
  fi

  echo ""
fi

# ── Summary ─────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"

if [[ $BACKEND_PASS -eq 1 && $FRONTEND_PASS -eq 1 && $UI_CHECK_PASS -eq 1 && $PROD_SMOKE_PASS -eq 1 ]]; then
  echo -e "  ${GREEN}All test suites passed ✅${NC}"
  echo ""
  exit 0
else
  [[ $BACKEND_PASS -eq 0 ]] && echo -e "  ${RED}Backend tests failed ❌${NC}"
  [[ $FRONTEND_PASS -eq 0 ]] && echo -e "  ${RED}Frontend tests failed ❌${NC}"
  [[ $UI_CHECK_PASS -eq 0 ]] && echo -e "  ${RED}Frontend UI checks failed ❌${NC}"
  [[ $PROD_SMOKE_PASS -eq 0 ]] && echo -e "  ${RED}Production smoke checks failed ❌${NC}"
  echo ""
  exit 1
fi
