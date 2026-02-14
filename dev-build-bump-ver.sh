#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found in PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH." >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "Error: package.json not found at repository root." >&2
  exit 1
fi

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ "$DRY_RUN" == true ]]; then
  node - <<'NODE'
const fs = require('fs');
const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const current = String(pkg.version ?? '');
if (!current) {
  throw new Error('package.json version is missing.');
}
const match = current.match(/(\d+)(?!.*\d)/);
if (!match || typeof match.index !== 'number') {
  throw new Error(`No numeric segment found in version: ${current}`);
}
const oldNumber = match[1];
const nextNumber = String(Number(oldNumber) + 1);
const next = `${current.slice(0, match.index)}${nextNumber}${current.slice(match.index + oldNumber.length)}`;
console.log(`Dry run: ${current} -> ${next}`);
console.log('Dry run: would run npm run build after bump.');
NODE
  exit 0
fi

node - <<'NODE'
const fs = require('fs');
const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const current = String(pkg.version ?? '');
if (!current) {
  throw new Error('package.json version is missing.');
}
const match = current.match(/(\d+)(?!.*\d)/);
if (!match || typeof match.index !== 'number') {
  throw new Error(`No numeric segment found in version: ${current}`);
}
const oldNumber = match[1];
const nextNumber = String(Number(oldNumber) + 1);
const next = `${current.slice(0, match.index)}${nextNumber}${current.slice(match.index + oldNumber.length)}`;
pkg.version = next;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`Bumped version: ${current} -> ${next}`);
NODE

echo "Reminder: package.json is the version source of truth."
echo "Reminder: production build uses npm scripts. Running: npm run build"
npm run build
