#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_DIR="${1:-$ROOT_DIR/liquidgl_local}"
PORT="${2:-8092}"

if [ ! -d "$DEMO_DIR" ]; then
  echo "Directory not found: $DEMO_DIR" >&2
  exit 1
fi

echo "Serving LiquidGL demos from: $DEMO_DIR"
echo "Open:"
echo "  http://localhost:${PORT}/demos/demo-3.html"
echo "  http://localhost:${PORT}/demos/demo-4.html"
echo "  http://localhost:${PORT}/demos/demo-5.html"
python3 -m http.server "$PORT" --directory "$DEMO_DIR"
