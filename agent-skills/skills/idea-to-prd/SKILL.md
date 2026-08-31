---
name: idea-to-prd
description: Works with the user to scope a single idea, or one chosen path/option from an existing Idea document, into one committed PRD. Trigger on "turn this into a PRD," "scope this idea," "write the PRD for X," "let's PRD this out," or when the user references an idea doc and wants to move toward something buildable. Unlike idea-capture, which preserves multiple open paths and variables on purpose, this skill's job is convergence — it forces open variables and competing paths toward a single resolved scope, while still never inventing requirements, goals, or features the user hasn't stated. NOT for open-ended brainstorming (use idea-capture for that) and NOT for defects, BDD stories, technical/task stories, or agent handoff docs.
---

# Idea → PRD

## Core principle

Same as idea-capture: don't originate content, organize and challenge what the user gives you. The difference here is the *mode*. idea-capture protects open possibility; this skill exists to close it down into one buildable scope. So:

- **Convergence, not generation.** When you hit an unresolved variable or a still-open path, don't decide it and don't leave it open either — put it to the user directly and get a decision before moving on. A PRD with an unresolved fork in it isn't scoped.
- **Still never invent.** Forcing a decision means asking "which of these did you mean to commit to?" — not proposing a third option or filling a gap with something plausible-sounding. If the user doesn't know yet, say so in Open Questions rather than papering over it.
- **One PRD per session.** If the user is trying to scope two divergent paths at once, stop and say so — that's two PRDs, or a decision to make first, not one document trying to hold both.

## Session flow

### 1. Establish the source

Find out what's being scoped:
- An existing Idea document (pasted, uploaded, or referenced by file path) — if it has multiple top-level paths or unresolved feature-level options, ask which path is being scoped before going further. Don't guess which one they mean.
- A freeform idea stated directly in this conversation, with no prior Idea document — that's fine, proceed the same way, just without a source doc to pull from.

Either way, restate your understanding of what's being scoped in a sentence or two and confirm before proceeding — this anchors the rest of the session and catches early misreads.

### 2. Walk the PRD sections conversationally

Don't dump the whole template as a form to fill out. Work through it a section at a time, in whatever order the conversation naturally goes, asking for what's missing:

- **Problem statement** — what's broken/missing, who feels it. If the user jumps straight to a solution, reflect that back and ask what problem it's solving.
- **Goals / non-goals** — goals are usually stated; non-goals often aren't. Ask directly what's explicitly out of scope, since that's exactly the kind of thing PRDs are supposed to make committed rather than implicit.
- **Users / audience** — who this is for.
- **Requirements** — elicit these from the user one at a time or in batches; number and prioritize (must/should/could) as stated. If two stated requirements conflict, surface it immediately as a decision to make now, not something to soften into both.
- **Success metrics** — if the user hasn't stated how they'll know this worked, ask. Don't invent a metric on their behalf.
- **Dependencies / risks** — capture what's stated; ask if anything obvious seems missing rather than listing risks yourself.

### 3. Force resolution of anything still open

If the source Idea document (or the conversation) has variables tagged as open, or a feature-level option that was never picked, this is the point where they get resolved. Ask plainly: "the idea doc left X open as a variable — for this PRD, which way are we going?" Log genuinely unresolved items in **Open Questions** rather than guessing — but don't let something stay silently ambiguous when the user could just answer it now.

### 4. Close and produce the PRD

1. Read `references/templates/prd-template.md` (don't reconstruct it from memory).
2. Fill it from what's been established in the conversation — nothing invented.
3. Fill "Source idea" with a reference to the originating Idea document and which path/option this PRD scopes, if applicable.
4. Write the completed doc to `/mnt/user-data/outputs/<slug>-prd.md` and present it via `present_files`.

## Template

This skill draws its output structure from `references/templates/prd-template.md`, synced from the canonical template source (see `../scripts/sync_templates.py` and `../manifest.json` at the repo root this skill ships from). Don't hand-edit that file expecting it to persist — edit the canonical source and re-sync, or it'll be overwritten on the next publish.
