#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH." >&2
  exit 1
fi

MODE="${1:-full}"

if [[ "$MODE" == "quick" ]]; then
  echo "Reminder: quick checks via npm scripts (typecheck)."
  npm run typecheck
  exit 0
fi

echo "Reminder: full checks via npm scripts (lint, typecheck, test)."
npm run lint
npm run typecheck
npm run test
