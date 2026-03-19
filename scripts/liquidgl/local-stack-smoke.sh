#!/usr/bin/env bash
set -euo pipefail

FRONTEND_BASE="${FRONTEND_BASE:-http://localhost:4200}"
API_BASE="${API_BASE:-http://localhost:3000}"
SEARCH_QUERY="${SEARCH_QUERY:-keywords=portal}"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node runtime not found. Install node or set PATH." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/pse-liquid-local-smoke-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

echo
echo "Local stack smoke checks"
echo "  FRONTEND_BASE=${FRONTEND_BASE}"
echo "  API_BASE=${API_BASE}"
echo

echo "[1/3] Frontend route" 
FRONTEND_STATUS="$(curl -sS -o "$TMP_DIR/home.html" -w '%{http_code}' "${FRONTEND_BASE}/")"
[[ "$FRONTEND_STATUS" == "200" ]] || fail "Frontend returned HTTP ${FRONTEND_STATUS}"
if ! rg -q "main-" "$TMP_DIR/home.html"; then
  fail "Frontend response did not include bundled app assets"
fi
echo "OK: Frontend"

echo "[2/3] Backend health"
HEALTH_STATUS="$(curl -sS -o "$TMP_DIR/health.json" -w '%{http_code}' "${API_BASE}/api/health")"
[[ "$HEALTH_STATUS" == "200" ]] || fail "Backend health returned HTTP ${HEALTH_STATUS}"
"$NODE_BIN" - "$TMP_DIR/health.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.status !== 'ok') {
  throw new Error(`Expected status=ok, got ${String(payload.status)}`);
}
NODE
echo "OK: Backend health"

echo "[3/3] Search relevance quick check (${SEARCH_QUERY})"
SEARCH_URL="${API_BASE}/api/search?${SEARCH_QUERY}"
SEARCH_STATUS="$(curl -sS -o "$TMP_DIR/search.json" -w '%{http_code}' "$SEARCH_URL")"
[[ "$SEARCH_STATUS" == "200" ]] || fail "Search returned HTTP ${SEARCH_STATUS}"
"$NODE_BIN" - "$TMP_DIR/search.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(payload)) throw new Error('Search payload is not an array');
if (payload.length === 0) throw new Error('Search payload is empty');
const names = payload.map(x => String(x?.name || ''));
const hasPortal = names.some(n => /portal/i.test(n));
console.log(`count=${payload.length}`);
console.log(`hasPortalLike=${hasPortal}`);
if (!hasPortal) {
  console.warn('WARN: No Portal-like title found in local search response.');
}
NODE
echo "OK: Search endpoint reachable and returns cards"

echo
echo "Local smoke checks completed."
