#!/usr/bin/env bash
# ============================================================
# dev-start.sh — Launch backend + frontend in one command
# Usage: bash scripts/dev-start.sh
#
# Starts both servers and traps Ctrl+C to kill them cleanly.
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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"

BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup on exit ─────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null && echo -e "  Stopped backend  (PID $BACKEND_PID)"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && echo -e "  Stopped frontend (PID $FRONTEND_PID)"
  wait 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Banner ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Project Steam Engine — Dev Launcher${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

# ── Pre-flight checks ──────────────────────────────────────
echo -e "${BOLD}[Pre-flight] Data pipeline${NC}"
if bash "$SCRIPT_DIR/check-data.sh" 2>/dev/null | tail -3 | head -1 | grep -q "complete"; then
  echo -e "  ${GREEN}✅ Data pipeline OK${NC}"
else
  echo -e "  ${YELLOW}⚠  Some data pipeline files are missing — recommendations may not work${NC}"
  echo -e "  ${DIM}   Run: npm run data:pipeline${NC}"
fi
echo ""

echo -e "${BOLD}[Pre-flight] Database${NC}"
if bash "$SCRIPT_DIR/db-health.sh" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Database OK${NC}"
else
  echo -e "  ${YELLOW}⚠  Database check failed — some features may not work${NC}"
  echo -e "  ${DIM}   Run: bash scripts/db-health.sh  for details${NC}"
fi
echo ""

# ── Start Backend ───────────────────────────────────────────
echo -e "${BOLD}[Starting] Backend${NC}"
if [[ -f "$BACKEND_DIR/package.json" ]]; then
  cd "$BACKEND_DIR"
  npm run dev &
  BACKEND_PID=$!
  echo -e "  ${GREEN}✅ Backend started${NC}  ${DIM}PID ${BACKEND_PID}${NC}"
  echo -e "     ${CYAN}http://localhost:3000${NC}"
else
  echo -e "  ${RED}❌ backend/package.json not found${NC}"
fi
echo ""

# ── Start Frontend ──────────────────────────────────────────
echo -e "${BOLD}[Starting] Frontend${NC}"
if [[ -f "$FRONTEND_DIR/package.json" ]]; then
  cd "$FRONTEND_DIR"
  npx ng serve &
  FRONTEND_PID=$!
  echo -e "  ${GREEN}✅ Frontend started${NC}  ${DIM}PID ${FRONTEND_PID}${NC}"
  echo -e "     ${CYAN}http://localhost:4200${NC}"
else
  echo -e "  ${YELLOW}⚠  frontend/package.json not found — skipping${NC}"
fi
echo ""

# ── Wait ────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "  ${GREEN}Both servers running. Press Ctrl+C to stop.${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

wait
