#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required but not found in PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must run inside a git repository." >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Error: unable to determine current git branch." >&2
  exit 1
fi

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: release must be run from main. Current branch: $CURRENT_BRANCH" >&2
  exit 1
fi

echo "Step 1/4: bump version and build"
./dev-build-bump-ver.sh

echo "Step 2/4: run full validation checks"
./dev-test.sh

NEW_VERSION="$(node -p "require('./package.json').version")"
if [[ -z "$NEW_VERSION" || "$NEW_VERSION" == "undefined" ]]; then
  echo "Error: package.json version is missing after bump." >&2
  exit 1
fi

echo "Step 3/4: stage and commit release changes"
git add -A
if [[ -z "$(git status --porcelain)" ]]; then
  echo "Error: no changes to commit after release build." >&2
  exit 1
fi
git commit -m "release: v${NEW_VERSION}"

echo "Step 4/4: push release commit to origin/main"
git push origin main

echo "Release complete: v${NEW_VERSION}"
