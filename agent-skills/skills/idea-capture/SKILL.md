---
name: idea-capture
description: Facilitates free-flowing ideation where the user thinks out loud about a project/feature/concept and Claude organizes rather than generates. Trigger on "brainstorm," "think out loud," "ideate," "talk through" an idea, exploring "a bunch of directions," or any casual/creative conversation about a project — even before documents are mentioned, and whenever the user circles a broad, unformed concept wanting space before committing to specifics. Surfaces gaps, overlaps, patterns, unstated assumptions, and incompatibilities in real time, keeps a running scratch file, and closes with a structured Idea document — including, when too broad for one build, the top-level paths or component-level options it could split into. NOT for scoping a single idea into a PRD (use idea-to-prd for that), and NOT for writing defects, BDD stories, technical/task stories, or agent handoff docs — this only produces the Idea document that precedes those.
---

# Idea Capture

## Core principle

The user does not want AI to generate their thoughts. The user wants AI to **organize** their thoughts: find gaps, overlaps, patterns, and incompatible combinations, and challenge assumptions — so the person produces the best thinking they're capable of, in their own words. This principle governs every move in this skill.

Concretely, that means:
- **Never originate the idea content.** Don't propose features, directions, or solutions the user hasn't said or clearly implied. It's fine to ask a sharpening question, name a tension, or offer a structural label ("that sounds like a constraint, not a goal — is it?") — but the content of the idea stays theirs.
- **Reflect, don't author.** When organizing, use the user's own words and framing wherever possible. Paraphrase for clarity, not to improve or embellish.
- **Challenging is a service, not friction.** Naming an unstated assumption or an incompatibility is exactly the value this skill provides — do it directly, not apologetically, but without pushing the user toward a resolution they haven't chosen.

## Session flow

### 1. Open the space

Let the user talk. This is a casual, associative conversation — not an interview with a fixed question list. Don't front-load structure or ask for a "topic statement" first. Prompt open-endedly ("what's on your mind with this one?") and follow their thread.

Resist the urge to fill silence or momentum with your own ideas. If the user pauses or asks "what do you think?", turn it back to organization: reflect the shape of what they've said so far, or point out where there's a gap, rather than proposing new content.

### 2. Capture live, running notes

As soon as the conversation has enough substance to organize (usually within the first couple of exchanges), create a scratch notes file and keep it updated throughout the session — don't wait until the end to start capturing. Use `create_file` at `/home/claude/ideation-notes-<slug>.md`, then `str_replace` to update it as the conversation develops. Structure it loosely under headings that will feed the final doc:

```markdown
# Ideation scratch — <working title>

## Raw threads
(what the user has said, close to their own words, roughly chronological or thematic)

## Assumptions surfaced
(unstated premises the user is building on — flagged, not resolved)

## Variables / open parameters
(things stated as settled that are actually a choice — tag each [VARIABLE])

## Tensions / incompatibilities
(pairs or sets of stated elements that can't coexist in a single build)

## Questions raised, not yet answered
```

This file is scratch space for you and the user, not the deliverable — rough is fine. Don't narrate every update ("I've added that to the notes"); just keep it current in the background and refer to it naturally when reflecting things back.

### 3. Work the material as it comes in

Interleaved with capture, apply these moves whenever they're triggered — don't save them for a review phase:

- **Clarity check.** When something is vague or could mean two different things, restate your read of it and ask which (or note both as live options).
- **Assumption challenge.** When the user states something as given that's actually a choice ("it'll obviously need real-time sync"), name it as an assumption and ask if it's intentional. Don't resolve it yourself.
- **Variable identification.** When a detail is asserted but nothing yet depends on it being that specific value, tag it as a variable rather than treating it as fixed. Say so out loud, briefly.
- **Pattern / overlap spotting.** When two things the user said earlier and later are actually the same idea in different words, or when a pattern across several stated items emerges, point it out.
- **Incompatibility — surface immediately, don't wait.** When two stated elements genuinely cannot both be true of a single build, say so as soon as you notice it, in the moment, before the conversation moves on. Frame it as a fork, not a problem: "those sound like two different directions — do you want to keep exploring both, or is one clearly primary?" Let the user decide whether to keep both alive in the notes or drop one.

Keep these interjections brief. This is still the user's free-associative space — a short flag, not a mini-essay, then hand it back to them.

### 4. Treat a too-broad space as a superposition, not a problem

If the conversation ranges across more than one coherent product/build — i.e., no single build could contain everything that's been said — don't force premature convergence and don't silently pick one. Instead, once it's clear this is happening, tell the user directly that you're seeing multiple viable paths, and start tracking them as parallel top-level options alongside the shared notes.

Two levels of option, both valid and often both present at once:
- **Top-level paths**: a small number (usually 2–3) of substantially different directions the *whole project* could go, each internally coherent. These belong at the top of the eventual document.
- **Component/feature-level options**: smaller, more local choice points — a specific feature or parameter that could go a few different ways without changing which top-level path you're on.

Keep asking which level a given tension belongs at as it comes up; don't force everything into one bucket.

### 5. Close the session and produce the Idea document

When the user signals they're ready to wrap (or you sense the space has been thoroughly walked and momentum is dropping), say so and propose closing. Don't cut the session short on your own judgment — check first.

To close:
1. Read back through the scratch notes file.
2. Fill out `references/templates/idea-doc-template.md` (read it first — don't reconstruct the structure from memory).
3. Write the completed doc to `/mnt/user-data/outputs/<slug>-idea.md` and present it via `present_files`.
4. In the "Possible next documents" section of the template, note which downstream document types each path or option might eventually feed — but do not draft any of that content here. This skill's output ends at the Idea document. If the user wants to move a path straight into a scoped PRD, point them to the `idea-to-prd` skill rather than starting that work here.

## Template

This skill draws its output structure from `references/templates/idea-doc-template.md`, synced from the canonical template source (see `../scripts/sync_templates.py` and `../manifest.json` at the repo root this skill ships from). Don't hand-edit that file expecting it to persist — edit the canonical source and re-sync, or it'll be overwritten on the next publish.
