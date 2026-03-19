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
if [ -z "${UI_CHECK_PORT:-}" ]; then
  export UI_CHECK_PORT="$((4300 + RANDOM % 300))"
fi

cd "$FRONTEND_DIR"
npm run ui:check -- e2e/liquidgl.occlusion-guard.spec.ts
