#!/bin/sh

set -eu

# Repo this script lives in (not a hardcoded ~/dotfiles path).
SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
DOTFILES_DIR="$(CDPATH= cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_SETTINGS="${DOTFILES_DIR}/vscode/settings.json"
SHELL_ALIASES="${DOTFILES_DIR}/shell/aliases.sh"
TERMUX_PROPERTIES="${DOTFILES_DIR}/termux/termux.properties"
GIT_SHARED="${DOTFILES_DIR}/git/gitconfig.shared"
HOOK_BEGIN="# >>> dotfiles >>>"
HOOK_END="# <<< dotfiles <<<"

detect_os() {
  if [ -n "${TERMUX_VERSION:-}" ]; then
    echo "termux"
    return
  fi

  case "${PREFIX:-}" in
    */com.termux/*)
      echo "termux"
      return
      ;;
  esac

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

quote_posix() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

git_value_regex() {
  printf '%s' "$1" | sed -e 's/[.[\*^$]/\\&/g'
}

write_hook_block() {
  target_file="$1"
  hook_body="$2"
  label="$3"

  hook_body="$(printf '%s\n' "${hook_body}")"
  had_block=0

  if [ -f "${target_file}" ] && grep -Fq "${HOOK_BEGIN}" "${target_file}"; then
    current_block="$(awk '/^# >>> dotfiles >>>$/,/^# <<< dotfiles <<<$/' "${target_file}")"
    if [ "${current_block}" = "${hook_body}" ]; then
      echo "${label}: already-correct (${target_file})"
      return
    fi
    sed '/^# >>> dotfiles >>>$/,/^# <<< dotfiles <<<$/d' "${target_file}" > "${target_file}.dotfiles.tmp"
    mv "${target_file}.dotfiles.tmp" "${target_file}"
    existed=1
    had_block=1
  elif [ -f "${target_file}" ]; then
    existed=1
  else
    existed=0
  fi

  if [ "${existed}" -eq 0 ]; then
    printf '%s\n' "${hook_body}" > "${target_file}"
    echo "${label}: created (${target_file})"
    return
  fi

  if [ -s "${target_file}" ]; then
    last_char="$(tail -c 1 "${target_file}" || true)"
    if [ -n "${last_char}" ]; then
      printf '\n' >> "${target_file}"
    fi
  fi

  printf '%s\n' "${hook_body}" >> "${target_file}"
  if [ "${had_block}" -eq 1 ]; then
    echo "${label}: replaced (${target_file})"
  else
    echo "${label}: created (${target_file})"
  fi
}

install_shell_hooks() {
  quoted_dir="$(quote_posix "${DOTFILES_DIR}")"
  aliases_hook="${HOOK_BEGIN}
DOTFILES_DIR=${quoted_dir}
if [ -f \"\${DOTFILES_DIR}/shell/aliases.sh\" ]; then
  . \"\${DOTFILES_DIR}/shell/aliases.sh\"
fi
${HOOK_END}"

  write_hook_block "${HOME}/.bashrc" "${aliases_hook}" "bashrc hook"
  write_hook_block "${HOME}/.zshrc" "${aliases_hook}" "zshrc hook"

  if [ -f "${HOME}/.profile" ] && grep -q '\.bashrc' "${HOME}/.profile"; then
    return
  fi

  profile_hook="${HOOK_BEGIN}
if [ -n \"\${BASH_VERSION:-}\" ] && [ -f \"\${HOME}/.bashrc\" ]; then
  . \"\${HOME}/.bashrc\"
fi
${HOOK_END}"
  write_hook_block "${HOME}/.profile" "${profile_hook}" "profile hook"
}

remove_stale_git_includes() {
  shared_file="$1"
  existing="$(git config --global --get-all include.path 2>/dev/null || true)"
  if [ -z "${existing}" ]; then
    return
  fi

  printf '%s\n' "${existing}" | while IFS= read -r include_path; do
    [ -n "${include_path}" ] || continue
    case "${include_path}" in
      */git/gitconfig.shared)
        if [ "${include_path}" != "${shared_file}" ]; then
          git config --global --unset-all include.path "$(git_value_regex "${include_path}")" || true
        fi
        ;;
    esac
  done
}

ensure_git_include() {
  shared_file="$1"
  if [ ! -f "${shared_file}" ]; then
    echo "git include: skipped (missing ${shared_file})"
    return
  fi
  if ! command -v git >/dev/null 2>&1; then
    echo "git include: skipped (git not on PATH)"
    return
  fi

  remove_stale_git_includes "${shared_file}"

  if git config --global --get-all include.path 2>/dev/null | grep -Fxq "${shared_file}"; then
    echo "git include: already-correct (${shared_file})"
    return
  fi

  git config --global --add include.path "${shared_file}"
  echo "git include: created (${shared_file})"
}

os_name="$(detect_os)"
echo "detected os: ${os_name}"

if [ -f "${SHELL_ALIASES}" ]; then
  install_shell_hooks
else
  echo "shell aliases: skipped (missing ${SHELL_ALIASES})"
fi
ensure_git_include "${GIT_SHARED}"

case "${os_name}" in
  termux)
    if [ ! -f "${TERMUX_PROPERTIES}" ]; then
      echo "error: source termux properties not found at ${TERMUX_PROPERTIES}"
      exit 1
    fi
    link_file "${TERMUX_PROPERTIES}" "${HOME}/.termux/termux.properties" "termux.properties"
    echo "done: termux profile configured (shell hook + properties; skipped editor and CLI)"
    exit 0
    ;;
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

if [ ! -f "${SOURCE_SETTINGS}" ]; then
  echo "error: source settings file not found at ${SOURCE_SETTINGS}"
  exit 1
fi

link_file "${SOURCE_SETTINGS}" "${code_settings}" "vscode"
link_file "${SOURCE_SETTINGS}" "${cursor_settings}" "cursor"

DOTFILES_CLI="${DOTFILES_DIR}/scripts/dotfiles"
if [ -f "${DOTFILES_CLI}" ]; then
  link_file "${DOTFILES_CLI}" "${HOME}/.local/bin/dotfiles" "dotfiles CLI"
  echo "note: make sure ${HOME}/.local/bin is in your PATH to use the 'dotfiles' CLI"
fi

echo "done: editor settings, shell aliases, and git aliases are configured"
