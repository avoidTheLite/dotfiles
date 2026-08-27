# Claude routing for dotfiles skills

Use this file to orient Claude to the dotfiles skills system. The repo is built as a skill catalog and installer, not as a single app project.

## Operating model

- The `skills/` directory is the routing surface for agent-aware instructions.
- `skills/packages/` defines bundles that can be installed into a downstream repo.
- Skill content is versioned and validated in `SKILL.md` so update flows can detect drift or major changes.
- The custom `dotfiles` CLI installs these bundles into another repository, rather than asking the consuming repo to copy raw files manually.

## Preferred workflow

1. Determine whether the user wants a single skill or a named package.
2. Read the package list in `skills/packages/` before choosing a skill.
3. Match the requested work to the corresponding skill directory and its `SKILL.md`.
4. Preserve agent-generic instructions in the root skill body when possible.
5. If the skill content changes, always increment the version in that skill's `SKILL.md` frontmatter.

## Guardrails

- Do not treat `skills/` as a monolithic application.
- Do not install unreviewed package changes into another repo without reviewing the version delta.
- Do not silently overwrite local customizations in a consuming repo.

This repo is a catalog and distribution layer for reusable agent workflows, with the consuming repository remaining the runtime home for the work being built.
