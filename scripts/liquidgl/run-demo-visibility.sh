#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "node runtime not found. Install node or set PATH." >&2
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"
if [ -z "${DEMO_VIS_PORT:-}" ]; then
  export DEMO_VIS_PORT="$((10080 + RANDOM % 500))"
fi

cd "$ROOT_DIR/frontend"
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies (required for Playwright)..."
  npm install
fi

cd "$ROOT_DIR"
"$NODE_BIN" ./scripts/liquidgl/check-demo-visibility.mjs
