#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <project-name>"
  exit 1
fi

PROJECT_NAME="$1"
DOTFILES_DIR="${HOME}/dotfiles"
TEMPLATE_DIR="${DOTFILES_DIR}/project-template-monorepo"
DEST_DIR="$(pwd)/${PROJECT_NAME}"
PLACEHOLDER="__PROJECT_NAME__"

if [ ! -d "${TEMPLATE_DIR}" ]; then
  echo "error: template directory not found at ${TEMPLATE_DIR}"
  exit 1
fi

if [ -e "${DEST_DIR}" ]; then
  echo "error: destination already exists at ${DEST_DIR}"
  exit 1
fi

mkdir -p "${DEST_DIR}"
cp -R "${TEMPLATE_DIR}/." "${DEST_DIR}"

escaped_project_name="$(printf "%s" "${PROJECT_NAME}" | sed 's/[\/&]/\\&/g')"

find "${DEST_DIR}" -type f | while IFS= read -r file_path; do
  temp_path="${file_path}.tmp"
  sed "s/${PLACEHOLDER}/${escaped_project_name}/g" "${file_path}" > "${temp_path}"
  mv "${temp_path}" "${file_path}"
done

cd "${DEST_DIR}"
git init -b main
git add .
git commit -m "feat: scaffold ${PROJECT_NAME} monorepo"

echo ""
echo "scaffold complete: ${DEST_DIR}"
echo ""
echo "next steps:"
echo "  cd \"${DEST_DIR}\""
echo "  pnpm install"
echo "  pnpm lint"
echo ""
echo "the monorepo template includes:"
echo "  - root workspace (pnpm + turborepo)"
echo "  - packages/tsconfig (shared base tsconfig)"
echo "  - eslint + prettier extending ~/dotfiles configs"
echo "  - .vscode/settings.json + .devcontainer"
echo ""
echo "to add apps and packages, see the fullstack-monorepo skill"
echo "or ~/dotfiles/guides/INDEX.md"
