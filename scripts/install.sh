#!/bin/sh

set -eu

# Resolve DOTFILES_DIR: check if script parent directory has vscode/settings.json,
# otherwise fallback to default location in home directory.
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "${SCRIPT_DIR}/vscode/settings.json" ]; then
  DOTFILES_DIR="${SCRIPT_DIR}"
else
  DOTFILES_DIR="${HOME}/dotfiles"
fi
SOURCE_SETTINGS="${DOTFILES_DIR}/vscode/settings.json"

if [ ! -f "${SOURCE_SETTINGS}" ]; then
  echo "error: source settings file not found at ${SOURCE_SETTINGS}"
  exit 1
fi

detect_os() {
  uname_s="$(uname -s 2>/dev/null || echo unknown)"

  case "${uname_s}" in
    Darwin)
      echo "macos"
      return
      ;;
    Linux)
      if grep -qi "microsoft" /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      return
      ;;
  esac

  echo "unknown"
}

resolve_windows_user() {
  if command -v cmd.exe >/dev/null 2>&1; then
    win_user="$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' | tr -d '\n')"
    if [ -n "${win_user}" ]; then
      echo "${win_user}"
      return
    fi
  fi

  echo "${USER}"
}

link_file() {
  source_file="$1"
  target_file="$2"
  label="$3"

  target_dir="$(dirname "${target_file}")"
  mkdir -p "${target_dir}"

  if [ -L "${target_file}" ]; then
    current_target="$(readlink "${target_file}" || true)"
    if [ "${current_target}" = "${source_file}" ]; then
      echo "${label}: already-correct (${target_file})"
      return
    fi
    rm -f "${target_file}"
    ln -s "${source_file}" "${target_file}"
    echo "${label}: replaced (${target_file})"
    return
  fi

  if [ -e "${target_file}" ]; then
    rm -f "${target_file}"
    ln -s "${source_file}" "${target_file}"
    echo "${label}: replaced (${target_file})"
    return
  fi

  ln -s "${source_file}" "${target_file}"
  echo "${label}: created (${target_file})"
}

os_name="$(detect_os)"

case "${os_name}" in
  wsl)
    win_user="$(resolve_windows_user)"
    code_settings="/mnt/c/Users/${win_user}/AppData/Roaming/Code/User/settings.json"
    cursor_settings="/mnt/c/Users/${win_user}/AppData/Roaming/Cursor/User/settings.json"
    ;;
  macos)
    code_settings="${HOME}/Library/Application Support/Code/User/settings.json"
    cursor_settings="${HOME}/Library/Application Support/Cursor/User/settings.json"
    ;;
  linux)
    code_settings="${HOME}/.config/Code/User/settings.json"
    cursor_settings="${HOME}/.config/Cursor/User/settings.json"
    ;;
  *)
    echo "error: unsupported operating system"
    exit 1
    ;;
esac

echo "detected os: ${os_name}"
link_file "${SOURCE_SETTINGS}" "${code_settings}" "vscode"
link_file "${SOURCE_SETTINGS}" "${cursor_settings}" "cursor"

echo "done: editor settings symlinks are configured"

# Mirror husky and post-checkout hook in the target repository
# If a target repository path is provided as the first argument, use it.
# Otherwise, check if the current directory is a git repository.
TARGET_REPO=""
if [ "$#" -ge 1 ] && [ -d "$1" ]; then
  TARGET_REPO="$(cd "$1" && pwd)"
elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  TARGET_REPO="$(git rev-parse --show-toplevel 2>/dev/null)"
fi

if [ -n "${TARGET_REPO}" ] && [ -d "${TARGET_REPO}/.git" ]; then
  echo "target repository detected at: ${TARGET_REPO}"
  echo "configuring git post-checkout hook..."

  # Ensure husky is initialized in the target repository
  if command -v npx >/dev/null 2>&1; then
    (cd "${TARGET_REPO}" && npx husky)
  else
    (cd "${TARGET_REPO}" && git config core.hooksPath .husky)
  fi

  # Create or copy the post-checkout hook file
  mkdir -p "${TARGET_REPO}/.husky"
  if [ -f "${DOTFILES_DIR}/.husky/post-checkout" ]; then
    if [ ! "${DOTFILES_DIR}/.husky/post-checkout" -ef "${TARGET_REPO}/.husky/post-checkout" ]; then
      cp "${DOTFILES_DIR}/.husky/post-checkout" "${TARGET_REPO}/.husky/post-checkout"
    fi
  else
    cat << 'EOF' > "${TARGET_REPO}/.husky/post-checkout"
#!/bin/sh
# Get the hash of the previous HEAD, new HEAD, and the checkout flag
OLD_HEAD=$1
NEW_HEAD=$2
BRANCH_SWITCH=$3

# Only trigger if it was an actual branch switch (flag is 1)
if [ "$BRANCH_SWITCH" -eq 1 ]; then
  
  # Check if root or workspace dependency files changed between the branches
  if git diff --name-only "$OLD_HEAD" "$NEW_HEAD" | grep -E "package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock" > /dev/null; then
    echo ""
    echo "=========================================================="
    echo "⚠️  Dependency changes detected between branches!"
    echo "   Running fresh installation for the monorepo..."
    echo "=========================================================="
    echo ""

    # Detect the correct package manager and run the install
    if [ -f "pnpm-lock.yaml" ]; then
      pnpm install
    elif [ -f "yarn.lock" ]; then
      yarn install
    else
      npm install
    fi
    
    echo ""
    echo "✅ Workspace dependencies are now up to date."
    echo "=========================================================="
    echo ""
  fi
fi
EOF
  fi

  chmod +x "${TARGET_REPO}/.husky/post-checkout"
  echo "done: post-checkout hook configured in ${TARGET_REPO}"
fi
