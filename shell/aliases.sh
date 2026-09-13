# Shared entry point sourced by the managed hook in ~/.bashrc and ~/.zshrc.
# DOTFILES_DIR is set by scripts/install.sh as a POSIX-quoted literal.
# Keep this file POSIX-friendly and free of machine-specific paths.

if [ -z "${DOTFILES_DIR:-}" ]; then
  return 0 2>/dev/null || true
fi

# shellcheck disable=SC1091
. "${DOTFILES_DIR}/shell/rc.dotfiles"
