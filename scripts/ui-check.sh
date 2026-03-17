#!/usr/bin/env bash
# ============================================================
# ui-check.sh — Visual/UI quality checks (Playwright + Axe)
# Usage:
#   bash scripts/ui-check.sh
#   bash scripts/ui-check.sh --update
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"

# Ensure Playwright browser is installed for first-time setup.
if ! npx playwright --version >/dev/null 2>&1; then
  npm run ui:check:install
fi

if [[ "${1:-}" == "--update" ]]; then
  npm run ui:check:update
else
  npm run ui:check
fi
