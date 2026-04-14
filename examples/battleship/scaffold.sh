#!/bin/sh
# Generate a runnable Battleship (React + Vite + TypeScript) app using the
# dotfiles ESLint/Prettier wiring. No manual edits required after scaffold.
#
# Usage:
#   sh /path/to/dotfiles/examples/battleship/scaffold.sh [destination-dir]
#
# Default destination: ./battleship-game (under the current working directory).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DOTFILES_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)
TEMPLATE_DIR="${SCRIPT_DIR}/template"

DEST_DIR=${1:-"${PWD}/battleship-game"}
PLACEHOLDER='__PROJECT_NAME__'
PROJECT_NAME=$(basename "${DEST_DIR}")

if [ ! -d "${TEMPLATE_DIR}" ]; then
  echo "error: template not found at ${TEMPLATE_DIR}" >&2
  exit 1
fi

if [ -e "${DEST_DIR}" ]; then
  echo "error: destination already exists: ${DEST_DIR}" >&2
  exit 1
fi

if [ ! -f "${DOTFILES_ROOT}/eslint/eslint.base.js" ] || [ ! -f "${DOTFILES_ROOT}/prettier/prettier.base.js" ]; then
  echo "error: dotfiles repo incomplete at ${DOTFILES_ROOT} (need eslint/ and prettier/)" >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"
cp -R "${TEMPLATE_DIR}/." "${DEST_DIR}"

escaped_name=$(printf '%s' "${PROJECT_NAME}" | sed 's/[\/&]/\\&/g')
find "${DEST_DIR}" -type f ! -path '*/node_modules/*' | while IFS= read -r f; do
  if ! grep -q "${PLACEHOLDER}" "${f}" 2>/dev/null; then
    continue
  fi
  tmp="${f}.tmp"
  sed "s/${PLACEHOLDER}/${escaped_name}/g" "${f}" > "${tmp}"
  mv "${tmp}" "${f}"
done

printf '%s\n' "Created ${DEST_DIR}"
printf '%s\n' "Next:"
printf '%s\n' "  cd \"${DEST_DIR}\""
printf '%s\n' "  npm install"
printf '%s\n' "  npm run dev"
printf '%s\n' ""
printf '%s\n' "Requires ~/dotfiles (or a clone at \$HOME/dotfiles) for ESLint and Prettier configs."
