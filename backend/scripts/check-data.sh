#!/usr/bin/env bash
# ============================================================
# check-data.sh — Validate data pipeline files
# Usage: bash scripts/check-data.sh
#
# Checks that raw data, processed data, and recommender output
# all exist and are valid JSON (where applicable).
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
DATA_DIR="$(dirname "$SCRIPT_DIR")/data"

MISSING=0
CORRUPT=0

# ── Helpers ─────────────────────────────────────────────────
human_size() {
  local bytes="$1"
  if   (( bytes >= 1073741824 )); then echo "$(echo "scale=1; $bytes/1073741824" | bc)G"
  elif (( bytes >= 1048576 ));    then echo "$(echo "scale=1; $bytes/1048576" | bc)M"
  elif (( bytes >= 1024 ));       then echo "$(echo "scale=1; $bytes/1024" | bc)K"
  else echo "${bytes}B"
  fi
}

# check_file <relative_path> [validate_json]
check_file() {
  local rel_path="$1"
  local validate="${2:-false}"
  local full_path="${DATA_DIR}/${rel_path}"
  local label="data/${rel_path}"

  if [[ ! -f "$full_path" ]]; then
    echo -e "  ${RED}❌ ${label}${NC}  ${DIM}missing${NC}"
    MISSING=$((MISSING + 1))
    return
  fi

  local size
  size=$(stat -f%z "$full_path" 2>/dev/null || stat --printf="%s" "$full_path" 2>/dev/null)
  local hsize
  hsize=$(human_size "$size")

  if [[ "$size" -eq 0 ]]; then
    echo -e "  ${RED}❌ ${label}${NC}  ${DIM}empty file${NC}"
    CORRUPT=$((CORRUPT + 1))
    return
  fi

  if [[ "$validate" == "true" ]]; then
    if python3 -m json.tool "$full_path" > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅ ${label}${NC}  ${DIM}${hsize} · valid JSON${NC}"
    else
      echo -e "  ${YELLOW}⚠  ${label}${NC}  ${DIM}${hsize} · invalid JSON${NC}"
      CORRUPT=$((CORRUPT + 1))
    fi
  else
    echo -e "  ${GREEN}✅ ${label}${NC}  ${DIM}${hsize}${NC}"
  fi
}

# ── Banner ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Data Pipeline Validator${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "  Data dir: ${CYAN}${DATA_DIR}${NC}"
echo ""

# ── Stage 1: Raw Data ──────────────────────────────────────
echo -e "${BOLD}[Stage 1] Raw Data${NC}"
# Check for either CSV or JSON source
if [[ -f "${DATA_DIR}/raw/games.csv" ]] || [[ -f "${DATA_DIR}/raw/games.json" ]]; then
  [[ -f "${DATA_DIR}/raw/games.csv" ]]  && check_file "raw/games.csv"
  [[ -f "${DATA_DIR}/raw/games.json" ]] && check_file "raw/games.json" true
else
  echo -e "  ${RED}❌ No raw data found${NC}  ${DIM}need games.csv or games.json${NC}"
  MISSING=$((MISSING + 1))
fi
echo ""

# ── Stage 2: Processed Data ───────────────────────────────
echo -e "${BOLD}[Stage 2] Processed Data  ${DIM}(npm run data:process)${NC}"
check_file "processed/games.json"        true
check_file "processed/games-light.json"  true
check_file "processed/stats.json"        true
check_file "processed/tag-vocabulary.json" true
check_file "processed/app-id-map.json"   true
echo ""

# ── Stage 3: Recommender ──────────────────────────────────
echo -e "${BOLD}[Stage 3] Recommender  ${DIM}(npm run data:build-recommender)${NC}"
check_file "processed/recommender/similarity-index.json" true
check_file "processed/recommender/vectors.json"          true
check_file "processed/recommender/idf.json"              true
echo ""

# ── Pipeline Readiness ─────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════${NC}"

TOTAL_ISSUES=$((MISSING + CORRUPT))

if [[ "$TOTAL_ISSUES" -eq 0 ]]; then
  echo -e "  ${GREEN}Pipeline complete — all files present & valid ✅${NC}"
else
  echo -e "  ${RED}${MISSING} missing · ${CORRUPT} corrupt${NC}"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  if [[ ! -f "${DATA_DIR}/raw/games.csv" ]] && [[ ! -f "${DATA_DIR}/raw/games.json" ]]; then
    echo -e "    1. ${CYAN}npm run data:download${NC}"
  fi
  if [[ ! -f "${DATA_DIR}/processed/games-light.json" ]]; then
    echo -e "    2. ${CYAN}npm run data:process${NC}"
  fi
  if [[ ! -f "${DATA_DIR}/processed/recommender/similarity-index.json" ]]; then
    echo -e "    3. ${CYAN}npm run data:build-recommender${NC}"
  fi
fi

echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

exit "$TOTAL_ISSUES"
