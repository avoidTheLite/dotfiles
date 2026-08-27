---
name: skill-authoring
description: Defines the standards for authoring installable agent skills in the dotfiles repo, including versioning, package membership, and routing rules for downstream installation through the custom dotfiles CLI. Use for creating or updating skill folders under skills/<skill-name>/ so they remain agent-agnostic, versioned, and compatible with downstream install/update flows.
version: 0.1.0
status: draft
compatible_agents: [generic]
deps:
  tools: []
  skills: []
---

# Skill authoring

## Purpose

This repo is the source of truth for installable skills and named skill bundles. Skills live under `skills/<skill-name>/` and are consumed by downstream repositories through the custom `dotfiles` CLI. The goal is to keep the skill instructions portable, discoverable, and safe to install without silently overwriting a repo’s local work.

## Required structure

- Create one skill directory per skill: `skills/<skill-name>/`
- Keep the canonical skill file as `SKILL.md`
- Store agent-specific variants only in `adapters/` when they are necessary
- Keep package membership under `skills/packages/` as text lists of skill names

## Authoring rules

- Keep the body agent-agnostic unless an agent-specific adapter is truly required.
- Write a self-sufficient `description` that tells an agent when the skill is relevant without needing surrounding context.
- Include the `version`, `status`, `compatible_agents`, and `deps` fields in frontmatter.
- Update the version whenever the skill content changes in the same commit as the edit.
- Treat major version changes as a review gate because they may require explicit confirmation before a downstream install updates existing repo content.

## Package and install model

- A package is a named list of skill names under `skills/packages/`.
- A package resolves against the current repo state at install time rather than pinning versions.
- The custom `dotfiles` CLI is responsible for routing installed skills and package bundles into another repo without breaking local edits.

## Validation

- Skill content changes must include a version bump in the skill’s frontmatter.
- CI runs `scripts/validate/check-skill-versioning.mjs` to enforce this when a skill directory changes in a branch.
- Changelog updates remain required for repo-level normative changes, especially for skill routing, validation, and installation policy shifts.

## Workflow

1. Define the skill’s purpose and relevant triggers in frontmatter.
2. Write the agent-agnostic method in `SKILL.md`.
3. Add or update package membership if the skill belongs in a bundled install.
4. Bump the version in the same commit that changes the skill content.
5. Run the repo validation script before merge.
