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

"$ROOT_DIR/scripts/liquidgl/fetch-demos.sh"
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/extract-demo-configs.mjs" "$ROOT_DIR/liquidgl_local"
"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/analyze-demo-features.mjs" "$ROOT_DIR/liquidgl_local"

echo "Source audit complete:"
echo "  - $ROOT_DIR/liquidgl_local/mirror-manifest.json"
echo "  - $ROOT_DIR/liquidgl_local/demo-configs.json"
echo "  - $ROOT_DIR/liquidgl_local/feature-matrix.json"
echo "  - $ROOT_DIR/docs/liquidgl-demo-feature-matrix.md"
