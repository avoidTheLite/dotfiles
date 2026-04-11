#!/bin/sh

set -eu

DOTFILES_DIR="${HOME}/dotfiles"
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
