# Agent routing for dotfiles skills

Treat this repo as the source of truth for reusable skill instructions and installable skill bundles. The goal is not to keep all work in this repo; the goal is to hand off a curated set of skills to another project through the custom `dotfiles` CLI.

## What to read first

1. Start with this file.
2. Read `skills/README.md` for the package model and install flow.
3. Read the relevant package file in `skills/packages/` to see which skills are grouped together.
4. Only then open the underlying skill instructions in the skill directory that the package references.

## Operation rules

- Route work by package first, then by individual skill.
- Keep skill instructions agent-agnostic when possible.
- If an agent-specific variant is needed, keep it in a documented adapter pattern rather than branching the main instructions.
- When a skill's content changes, update its `version` in `SKILL.md` in the same change.
- When a package changes, document the effect in the repo changelog and explain whether it adds or alters installed behavior.

## Install intent

This repo exists to make installation into another repository predictable:

- package definitions live in `skills/packages/`
- skills are installed as a unit or as named bundles
- downstream repos can update or drift-check installed copies without silently overwriting local edits

Use this repo as the shared source of truth for reusable operational patterns, not as the final runtime workspace for the installed project.
