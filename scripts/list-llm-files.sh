#!/usr/bin/env bash
# List files relevant for LLM context (source, config, docs)
# Usage: list-llm-files.sh [directory]
# Default: current directory

set -euo pipefail

DIR="${1:-.}"

find "$DIR" -type f \( \
  -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" -o \
  -name "*.sql" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o \
  -name "*.html" -o -name "*.css" -o -name "*.yaml" -o -name "*.yml" \
\) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/.angular/*" \
  -not -path "*/__pycache__/*" \
  -not -name "package-lock.json" \
  -not -name "*.min.js" \
  2>/dev/null | sort
