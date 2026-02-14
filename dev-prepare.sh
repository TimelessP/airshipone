#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH." >&2
  exit 1
fi

echo "Reminder: setup is npm-first. Running dependency install + baseline checks."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npm run typecheck
