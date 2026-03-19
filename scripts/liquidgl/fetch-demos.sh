#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/liquidgl_local}"
BASE_URL="https://liquidgl.naughtyduk.com"

mkdir -p "$DEST_DIR/demos" "$DEST_DIR/scripts"

fetch_demo() {
  local n="$1"
  local out="$DEST_DIR/demos/demo-${n}.html"
  if curl -fsSL "$BASE_URL/demos/demo-${n}" -o "$out"; then
    echo "Downloaded demo-${n} -> $out"
    return 0
  fi
  curl -fsSL "$BASE_URL/demos/demo-${n}.html" -o "$out"
  echo "Downloaded demo-${n}.html -> $out"
}

for demo in 3 4 5; do
  fetch_demo "$demo"
done

curl -fsSL "$BASE_URL/scripts/liquidGL.js" -o "$DEST_DIR/scripts/liquidGL.js"
curl -fsSL "$BASE_URL/scripts/html2canvas.min.js" -o "$DEST_DIR/scripts/html2canvas.min.js"

cat <<MSG

LiquidGL demos fetched:
  - $DEST_DIR/demos/demo-3.html
  - $DEST_DIR/demos/demo-4.html
  - $DEST_DIR/demos/demo-5.html
  - $DEST_DIR/scripts/liquidGL.js
  - $DEST_DIR/scripts/html2canvas.min.js

Next:
  node "$ROOT_DIR/scripts/liquidgl/extract-demo-configs.mjs" "$DEST_DIR"
MSG
