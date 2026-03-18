#!/usr/bin/env bash
# ============================================================
# smoke-production.sh — Production smoke checks for live app
# Usage:
#   bash scripts/smoke-production.sh
#
# Optional env vars:
#   SITE_BASE=https://pse-mu.vercel.app
#   API_BASE=https://project-steam-engine-production.up.railway.app
#   SEARCH_QUERY='genres=RPG'
# ============================================================

set -euo pipefail

SITE_BASE="${SITE_BASE:-https://pse-mu.vercel.app}"
API_BASE="${API_BASE:-https://project-steam-engine-production.up.railway.app}"
SEARCH_QUERY="${SEARCH_QUERY:-genres=RPG}"

TMP_DIR="$(mktemp -d /tmp/pse-smoke-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "❌ $1" >&2
  exit 1
}

echo ""
echo "Production smoke checks"
echo "  SITE_BASE=${SITE_BASE}"
echo "  API_BASE=${API_BASE}"
echo ""

echo "[1/3] Frontend homepage"
HOME_STATUS="$(curl -sS -o "$TMP_DIR/home.html" -w '%{http_code}' "${SITE_BASE}/")"
[[ "$HOME_STATUS" == "200" ]] || fail "Homepage returned HTTP ${HOME_STATUS}"

MAIN_BUNDLE="$(rg -o 'main-[A-Z0-9]+\.js' "$TMP_DIR/home.html" -m1 || true)"
[[ -n "$MAIN_BUNDLE" ]] || fail "Homepage did not include a main bundle hash"
echo "✅ Homepage OK (bundle: ${MAIN_BUNDLE})"

echo "[2/3] Backend health"
HEALTH_STATUS="$(curl -sS -o "$TMP_DIR/health.json" -w '%{http_code}' "${API_BASE}/api/health")"
[[ "$HEALTH_STATUS" == "200" ]] || fail "Backend health returned HTTP ${HEALTH_STATUS}"

node - "$TMP_DIR/health.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.status !== 'ok') {
  throw new Error(`Expected status=ok, got ${String(payload.status)}`);
}
NODE
echo "✅ Backend health OK"

echo "[3/3] Search payload (card population readiness)"
SEARCH_URL="${API_BASE}/api/search?${SEARCH_QUERY}"
SEARCH_STATUS="$(curl -sS -D "$TMP_DIR/search.headers" -o "$TMP_DIR/search.json" -w '%{http_code}' "$SEARCH_URL")"
[[ "$SEARCH_STATUS" == "200" ]] || fail "Search endpoint returned HTTP ${SEARCH_STATUS}"

if ! rg -qi '^access-control-allow-origin:\s*\*' "$TMP_DIR/search.headers"; then
  fail "Search response missing Access-Control-Allow-Origin: *"
fi

node - "$TMP_DIR/search.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(payload)) {
  throw new Error('Search payload is not an array');
}
if (payload.length === 0) {
  throw new Error('Search payload is empty');
}
const first = payload[0] ?? {};
for (const key of ['appId', 'name']) {
  if (!(key in first)) {
    throw new Error(`Search payload missing key "${key}" on first result`);
  }
}
console.log(`count=${payload.length}`);
NODE
echo "✅ Search payload is non-empty and card-compatible"

echo ""
echo "All production smoke checks passed."
