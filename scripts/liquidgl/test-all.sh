#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "node runtime not found. Install node or set PATH." >&2
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"
NPM_BIN="$(command -v npm || true)"
if [ -z "$NPM_BIN" ] && [ -x "/opt/homebrew/bin/npm" ]; then
  NPM_BIN="/opt/homebrew/bin/npm"
fi
if [ -z "$NPM_BIN" ]; then
  echo "npm not found. Install npm or set PATH." >&2
  exit 1
fi
if [ -z "${UI_CHECK_PORT:-}" ]; then
  export UI_CHECK_PORT="$((4300 + RANDOM % 300))"
fi

echo "[1/10] Fetching full liquidGL source mirror..."
"$ROOT_DIR/scripts/liquidgl/fetch-demos.sh"

echo "[2/10] Verifying source mirror coverage..."
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/check-source-coverage.mjs"

echo "[3/10] Extracting demo liquidGL configs..."
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/extract-demo-configs.mjs"

echo "[4/10] Generating demo feature matrix..."
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/analyze-demo-features.mjs"

echo "[5/10] Verifying parity against result-screen wiring..."
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/verify-parity.mjs"

echo "[6/10] Verifying demo-4 card visibility baseline..."
"$ROOT_DIR/scripts/liquidgl/run-demo-visibility.sh"

echo "[7/10] Verifying layer + no-imitation contract..."
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/check-contract.mjs"

echo "[8/10] Running liquidGL UI tests..."
(
  cd "$FRONTEND_DIR"
  "$NPM_BIN" run ui:check -- e2e/liquidgl.results.spec.ts e2e/liquidgl.layering.spec.ts e2e/liquidgl.drag-visibility.spec.ts e2e/liquidgl.fallback-visibility.spec.ts
)

echo "[9/10] Running dedicated occlusion guard script..."
"$ROOT_DIR/scripts/liquidgl/run-occlusion-check.sh"

echo "[10/10] Building frontend..."
(
  cd "$FRONTEND_DIR"
  "$NPM_BIN" run build
)

echo "LiquidGL integration checks completed successfully."
