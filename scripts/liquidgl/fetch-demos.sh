#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/liquidgl_local}"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "node runtime not found. Install node or set PATH." >&2
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"

"$NODE_BIN" "$ROOT_DIR/scripts/liquidgl/fetch-site-content.mjs" "$DEST_DIR"

cat <<MSG

LiquidGL site mirror fetched:
  - index + demos 1-5
  - local assets/scripts referenced by those pages
  - remote JS/CSS vendor libs referenced by those pages
  - $DEST_DIR/mirror-manifest.json

Next:
  node "$ROOT_DIR/scripts/liquidgl/extract-demo-configs.mjs" "$DEST_DIR"
MSG
