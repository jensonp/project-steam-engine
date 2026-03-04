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

# ── Summary ─────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"

if [[ $BACKEND_PASS -eq 1 && $FRONTEND_PASS -eq 1 ]]; then
  echo -e "  ${GREEN}All test suites passed ✅${NC}"
  echo ""
  exit 0
else
  [[ $BACKEND_PASS -eq 0 ]] && echo -e "  ${RED}Backend tests failed ❌${NC}"
  [[ $FRONTEND_PASS -eq 0 ]] && echo -e "  ${RED}Frontend tests failed ❌${NC}"
  echo ""
  exit 1
fi
