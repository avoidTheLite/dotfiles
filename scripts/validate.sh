#!/usr/bin/env bash
# Run from repo root (or any cwd); resolves paths relative to this file.
# Requires bash (not plain POSIX sh) for pipefail; use: bash scripts/validate.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node &>/dev/null; then
  echo "error: node is required for validation (install Node 20+ for local use)."
  exit 1
fi

export NODE_NO_WARNINGS=1

node "$ROOT/scripts/validate/manifest.mjs"
node "$ROOT/scripts/validate/internal-links.mjs"
node "$ROOT/scripts/validate/check-changelog.mjs"
node "$ROOT/scripts/validate/check-exception-markers.mjs"
node "$ROOT/scripts/validate/check-guides-changelog.mjs"
node "$ROOT/scripts/validate/branch-name.mjs"

if command -v gitleaks &>/dev/null; then
  gitleaks detect --source . --config .gitleaks.toml --redact -v
else
  echo "Note: gitleaks not in PATH; skipping local secret scan (CI still runs gitleaks)."
fi

echo "All validation checks passed."
