# Skills

This repository is the canonical routing surface for installable agent skills and skill packages. The `skills/` folder exists to orient agents, describe package membership, and provide the install source for the custom `dotfiles` CLI.

## How this repo is used

- `AGENT.md` explains how agents should discover and install reusable skills.
- `Claude.md` gives the Claude-specific entry point for the same system.
- `packages/` contains named package lists that can be installed as a bundle into another repository.
- A downstream repo consumes these packages through the `dotfiles` CLI rather than copying raw skill instructions by hand.

## Package model

Packages are not pinned versions. A package resolves directly to whatever skill folders are currently present in this repository at installation time. That keeps the repo flexible while still letting downstream repos opt into coherent bundles.

## Versioning policy

Any committed change to the actual content of a skill requires a version increment in that skill's `SKILL.md` frontmatter. This allows downstream install/update flows to detect when a change is likely to be breaking or materially different before overwriting a local repository.
