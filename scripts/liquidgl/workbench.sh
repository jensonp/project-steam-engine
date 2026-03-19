#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/liquidgl/workbench.sh <command>

Commands:
  audit        Fetch and analyze full liquidGL source set.
  smoke        Run local frontend/backend smoke checks.
  demo         Validate demo-4 card visibility baseline.
  fallback     Validate app card visibility in forced no-WebGL mode.
  occlusion    Validate card readability + z-layer occlusion guard.
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
  audit)
    "$ROOT_DIR/scripts/liquidgl/run-source-audit.sh"
    ;;
  smoke)
    "$ROOT_DIR/scripts/liquidgl/local-stack-smoke.sh"
    ;;
  demo)
    "$ROOT_DIR/scripts/liquidgl/run-demo-visibility.sh"
    ;;
  fallback)
    "$ROOT_DIR/scripts/liquidgl/run-fallback-visibility.sh"
    ;;
  occlusion)
    "$ROOT_DIR/scripts/liquidgl/run-occlusion-check.sh"
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
