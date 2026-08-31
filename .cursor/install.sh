#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the dotfiles repository.
# Safe to run repeatedly and against cached/snapshot state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Scaffolded projects (project-template, examples/battleship) resolve their
# ESLint/Prettier base configs from "$HOME/dotfiles". Point that at this checkout
# so `npm/pnpm run lint` and `format` work in generated projects.
ln -sfn "$REPO_ROOT" "$HOME/dotfiles"

# gitleaks powers the optional local secret scan in scripts/validate.sh and is a
# required check in CI. Install it so `bash scripts/validate.sh` runs the full suite.
GITLEAKS_VERSION=8.21.2
if ! command -v gitleaks >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/gitleaks.tar.gz" \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
  tar -xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
  sudo install -m 0755 "$tmp/gitleaks" /usr/local/bin/gitleaks
  rm -rf "$tmp"
fi

echo "dotfiles environment ready:"
echo "  node:     $(node --version 2>/dev/null || echo 'not found')"
echo "  pnpm:     $(pnpm --version 2>/dev/null || echo 'not found')"
echo "  gitleaks: $(gitleaks version 2>/dev/null || echo 'not found')"
echo "  \$HOME/dotfiles -> $(readlink -f "$HOME/dotfiles")"
