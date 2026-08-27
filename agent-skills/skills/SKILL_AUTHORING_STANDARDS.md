# Skill Authoring Standards

Self-contained instructions for creating and maintaining skills in
`agent-skills/skills/`. Executable from this document alone — no conversation
context required.

## Scope

Applies to every skill under `agent-skills/skills/<skill-name>/`. Skills must be
agent-agnostic: no content that assumes Claude specifically unless
isolated in an agent-dialect adapter (see below). Git is the system of
record for history — this doc does not ask you to duplicate anything git
already tracks (see §6).

## 1. Folder layout

```
agent-skills/skills/<skill-name>/
├─ SKILL.md          # required — the skill, with version in frontmatter
└─ adapters/           # optional — only if agent-specific dialect is needed
   ├─ claude.md
   └─ copilot.md

agent-skills/skills/packages/
└─ <package-name>.md   # a named list of skill names — nothing else
```

- `<skill-name>`: lowercase, hyphen-separated, verb-or-noun phrase (e.g.
  `tree-mapper`). No abbreviations that aren't already standard elsewhere
  in the repo.
- No `skill.json`, no `CHANGELOG.md`, no `registry.json`. See §6 for why.
- Do not create subfolders beyond `adapters/` without a stated reason —
  one folder, one job.

## 2. `SKILL.md` requirements

YAML frontmatter — this is the entire machine-readable record for the
skill, replacing what would otherwise be a separate `skill.json`:

```yaml
---
name: tree-mapper
description: Walks a repo and produces a catalog of what's real, dead, or leftover. Use for auditing folder-based skill/agent structures before restructuring.
version: 0.1.0
status: draft          # draft | stable
compatible_agents: [claude, generic]
deps:
  tools: []
  skills: []
---
```

- `description` must be self-sufficient — it's what routes an agent to
  the skill, so "see below" isn't acceptable. Frontmatter alone should be
  enough to decide relevance.
- Body: the method. Bullet points over prose. No duplicate schema — if a
  `prompts` array or `workspace-standards.json` already defines a
  requirement, reference it, don't restate it.
- Content must be agent-agnostic. If a step genuinely differs by agent,
  name the difference and point to `adapters/<agent>.md` rather than
  branching inline.

## 3. Versioning

- **`0.1.0`** — default starting version for any new skill. `status: draft`.
- **`1.0.0`** — set only when the skill is complete: body finished,
  walk-tested (§5), `status: stable`.
- After `1.0.0`, semver applies, and **the bump is a judgment call you or
  the agent editing the skill make** — it's not derivable from the diff,
  which is why it lives in frontmatter instead of being inferred:
  - patch (`1.0.x`) — wording/fix, no behavior change
  - minor (`1.x.0`) — new capability, backward compatible
  - major (`x.0.0`) — **only** when the change won't work with whatever
    already consumes this skill downstream. This is the one bump that
    matters operationally: it's what tells the update flow (§7) to stop
    and ask instead of pulling silently.
- If an agent makes the edit, it bumps the version itself, in the same
  commit as the edit, per this rule — not a separate follow-up commit.
- Commit message is the changelog entry: `skill(tree-mapper): 0.1.0 →
  0.2.0 — add change-impact section`. This is grep-able later via
  `git log --oneline -- agent-skills/skills/tree-mapper` — no separate file needed.

## 4. Packages

A package is just a named list of skill names — nothing versioned, no
pinned ranges:

```markdown
# core
Baseline skills for any new workspace.

- tree-mapper
- spec-validator
```

- Since skills and packages live in the same repo, a package's "version"
  is whatever commit it's at — adding or removing a member is a normal
  commit to that file, with normal git history.
- A skill can belong to zero, one, or several packages.
- No pinning: a package always resolves its members to whatever's
  currently in `agent-skills/skills/` at update time (see §7 for how major bumps
  and Editions are handled within that).

## 5. Validation before marking `1.0.0` / `stable`

Walk-test the skill cold, as an agent with no memory of how it was built:

- Does `description` alone correctly decide whether this skill is
  relevant to a given task?
- Can the skill be followed start to finish using only `SKILL.md` plus
  its declared `deps` — no undeclared assumptions?
- Is any content duplicated from another skill or from
  `workspace-standards.json`? If so, replace with a reference.
- Does anything in the body assume a specific agent? If yes, move it to
  `adapters/` and generalize the body.

If any check fails, fix the skill — don't ship `1.0.0` with an open item.

## 6. Why there's no `registry.json`, `skill.json`, or `CHANGELOG.md`

Git already provides, for free, everything those files would duplicate:

- **History** — `git log -- agent-skills/skills/<name>` gives the full history of a
  skill, with real timestamps and messages, no upkeep required.
- **Content identity** — `git hash-object` (or a tree hash) gives a
  content-addressed identifier for a skill folder that changes if and
  only if the content changes. No need to hand-compute or store a
  `content_hash` inside the skill itself.
- **Discovery** — the CLI can scan `agent-skills/skills/*/SKILL.md` frontmatter and
  `agent-skills/skills/packages/*.md` directly at runtime to know what exists, rather
  than you maintaining a `registry.json` that has to stay in sync with
  the folders it's describing.

The only things frontmatter tracks that git can't infer on its own:
`version`/`status` (a judgment call about readiness and breakage) and
`compatible_agents`/`deps` (declared facts about the skill, not derivable
from a diff). Everything else — when it changed, what changed, how to
verify a copy matches source — is git's job.

## 7. Two workflows

### A. Promote a skill into dotfiles

Happens when you're working in some other repo (not dotfiles), a skill
gets created or usefully modified there, and you want it available
globally.

1. Copy the skill folder into `agent-skills/skills/<name>/` (new skill) or
   merge changes into the existing folder (edit).
2. Bump `version` in frontmatter per §3's rule — patch/minor for
   anything downstream still works with, major only if it doesn't.
3. Add/update package membership in `agent-skills/skills/packages/*.md` if it belongs
   in one.
4. Commit with a message that states the version change (doubles as the
   changelog — §3).

That's the whole workflow. No separate release step, no registry file to
update in lockstep — it's one commit.

### B. Update skills in a repo you've installed dotfiles into

Run from the consuming repo (`dotfiles update`):

1. CLI reads each installed skill's recorded version from the local
   lockfile, and the current version of that skill (and any package it
   came from) directly from the dotfiles repo.
2. **Patch/minor** — newer version pulled automatically, lockfile
   updated. No confirmation needed; this is the common case.
3. **Major** — stop and surface it explicitly (skill name, old → new
   version, and the commit message from §3 as the reason) and wait for
   confirmation before overwriting. This is the one case where "won't
   work with downstream tools" is exactly the risk being flagged.
4. **New skill added to an installed package** — same treatment as a
   major bump: surfaced, not auto-pulled, since it's new behavior showing
   up in the repo that wasn't explicitly asked for.
5. **Drift check** — before overwriting anything, compare the installed
   copy's content hash (git hash-object, computed fresh) against what
   the lockfile recorded at last install/update. Mismatch means it was
   hand-edited locally after install — flag it, don't silently clobber.

This document governs how skills are authored (§1–§6). Install/update
mechanics beyond what's described in §7 live in the CLI's own spec.

### C. Editions and Skill Package Version Bumping

An **Edition** is a repository-wide compatibility snapshot (e.g., `2026 Edition`) that defines a stable set of APIs, CLI behaviors, and skill-package configurations. It serves as an overarching release and compatibility boundary.

- **Purpose of Editions**:
  While individual skills can be modified and bumped independently (using SemVer under §3), **Editions** group skills and packages under a unified compatibility baseline. This prevents the "dependency hell" of coordinating multiple distinct major version upgrades across several independent skills.
- **Declaring and Managing Editions**:
  - Editions are declared at the repository level. A file under `agent-skills/skills/packages/` or a dedicated manifest lists the skill packages matching a specific Edition.
  - All skills in a package mapped to a given Edition are guaranteed to be fully compatible with each other and with the downstream CLI version that implements that Edition.
- **Handling Version Bumping in Packages under an Edition**:
  - **Intra-Edition Updates**: Patch and minor version updates to skills and packages within the same active Edition are automatically applied during a `dotfiles update` since they preserve backward compatibility.
  - **Major Version Bumps**: Any change to a skill that breaks downstream tools requires a major version bump (`x.0.0`) under §3. When such a break occurs, the skill package must either align with a new **Edition** or the update tool will halt.
  - **Cross-Edition Upgrades**: When a consuming repository upgrades its core dotfiles to align with a new **Edition**, the CLI performs a co-ordinated migration of all associated packages. The CLI will:
    1. Surface the Edition change, detailing the overall shift in behavior.
    2. List all major version changes of constituent skills with their associated git commit messages as the justification.
    3. Run local validation and drift checks, prompting the user for approval before overwriting any hand-edited local files.

## 8. Seeing everything at a glance

Dropping `registry.json` removes the sync problem, but not the need to
browse what exists. Solve that with a **generated** view instead of a
hand-maintained one — same information, zero drift risk, because nothing
about it is manually edited.

- **`dotfiles list`** — CLI command, scans `agent-skills/skills/*/SKILL.md` frontmatter
  and `agent-skills/skills/packages/*.md` on demand, prints a table: name, version,
  status, which package(s) it's in. This is the primary way to see
  everything and it's always current, since it's read fresh every run
  rather than stored anywhere.
- **`agent-skills/skills/INDEX.md`** (optional) — same scan, written to a file instead
  of stdout, regenerated by a pre-commit hook or the CLI itself whenever
  a skill or package changes. Marked at the top as generated:

  ```markdown
  <!-- GENERATED:START -->
  <!-- GENERATED:END -->
  ```

  This is worth having specifically because it's browsable on GitHub
  without running anything locally — useful when you're not at a
  terminal, or when someone else is looking at the repo.

  **Committed for now**, not gitignored — until the install-time
  generator exists, gitignoring it would mean a fresh clone has no
  `INDEX.md` and nothing to produce one. Once `dotfiles install` can
  regenerate it on first install, this can move to `.gitignore` with no
  loss of browsability (regenerated locally, committed copy just stops
  being the source people look at).
- If you want the root `CLAUDE.md`/`AGENTS.md` router itself to double as
  this view, the same regeneration can target a marked block inside those
  files (`<!-- SKILLS:START -->` … `<!-- SKILLS:END -->`) rather than a
  separate `INDEX.md` — one less file, and the router and the catalog
  are the same document. Worth doing only if you don't mind the router
  file getting longer than the "thin, routing-only" ideal from earlier;
  a separate `INDEX.md` keeps that file lean if you'd rather.

The distinction that matters: a *generated* catalog can never drift from
source, because it has no independent existence between scans. A
*hand-maintained* one (the original `registry.json`) always can, because
it's a second place the same fact is written down.
