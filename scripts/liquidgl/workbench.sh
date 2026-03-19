#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/liquidgl/workbench.sh <command>

Commands:
  smoke        Run local frontend/backend smoke checks.
  test         Run full liquidGL validation pipeline.
  drag         Run drag-visibility UI test.
  debug        Run headed UI debug tests with trace.
  dump         Generate runtime diagnostic JSON dump.
  design       Capture design screenshots for results + lens states.
  all          Run smoke + test + dump + design.
USAGE
}

cmd="${1:-}"
case "$cmd" in
  smoke)
    "$ROOT_DIR/scripts/liquidgl/local-stack-smoke.sh"
    ;;
  test)
    "$ROOT_DIR/scripts/liquidgl/test-all.sh"
    ;;
  drag)
    "$ROOT_DIR/scripts/liquidgl/run-drag-visibility.sh"
    ;;
  debug)
    "$ROOT_DIR/scripts/liquidgl/run-debug-ui.sh"
    ;;
  dump)
    "$ROOT_DIR/scripts/liquidgl/run-runtime-dump.sh"
    ;;
  design)
    "$ROOT_DIR/scripts/liquidgl/run-design-capture.sh"
    ;;
  all)
    "$ROOT_DIR/scripts/liquidgl/local-stack-smoke.sh"
    "$ROOT_DIR/scripts/liquidgl/test-all.sh"
    "$ROOT_DIR/scripts/liquidgl/run-runtime-dump.sh"
    "$ROOT_DIR/scripts/liquidgl/run-design-capture.sh"
    ;;
  *)
    usage
    exit 1
    ;;
esac
