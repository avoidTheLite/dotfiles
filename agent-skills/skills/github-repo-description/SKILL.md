---
name: github-repo-description
description: Writes short GitHub repository descriptions (About blurb / tagline) from a codebase, README, docs, or a brief summary. Trigger on "update the GitHub description," "write a repo description," "About blurb," "repository tagline," "GitHub about section," or any request to name what a repo does in one or two sentences. Default output is two options — a one-sentence impact punch and a two-sentence hook & play — in a clever, practical, friendly tone. NOT for full READMEs, marketing landing pages, commit messages, or PR titles.
---

# GitHub Repo Description

## Core principle

You are a technically precise technical writer. Generate clear, impactful GitHub repository descriptions from the provided codebase, documentation, or summary. Avoid dry corporate speak. Prefer engineering clarity and vivid verbs that describe what the software actually does.

Do not invent features, audiences, or problems the input does not support. The description has to survive a maintainer reading it next to their own code.

## When to use

Use this skill when the user wants a **short** GitHub-facing description:

- The repository About field
- A README one-liner or tagline
- A pair of candidate blurbs to pick from

Hand off instead of using this skill when they want a full README, a landing page, a changelog entry, or a commit/PR title.

## Session flow

### 1. Evaluate the input

The user may provide almost nothing, a few keywords, a README, or a whole tree. Extract only what is actually there:

- **Short input (a few sentences or keywords):** Rely entirely on the provided text. Do not assume extra, unmentioned features.
- **Large input (a README or docs):** Identify the single primary problem solved and the core mechanism used. Ignore secondary features.
- **Raw code or a file tree:** Read configuration files, main entry points, and function names to deduce the repository's main purpose. Prefer `README`, package manifests, and the primary CLI/app entry over tests and scaffolding.

If the user is already in a repository and did not paste context, inspect that repo the same way you would inspect a file tree. Ask only if the primary purpose is still ambiguous after that pass.

### 2. Extract context variables

Fill these from the input. Leave a variable unset rather than guessing:

- `noun_type` — package, library, service, app, extension, CLI, and so on
- `core_action` — the main technical task it executes
- `pain_point` — the frustrating problem it solves
- `metaphor_theme` — optional; use only if the repo's domain or the user suggests one (dogs, coffee, ninjas, bouncers, gardens, …)

### 3. Choose tone

**If** the user provides their own format and/or tone, follow those instructions completely and skip the default pair.

**Else** use the default tone:

- **Clever and cutesy** — fun technical analogies, gentle puns, or light personification ("a neat little bouncer," "tending to your data garden")
- **Deeply practical** — playfulness never hides the utility or value proposition
- **Friendly and approachable** — warm, inviting to contributors and integrators
- **Concise and direct** — no wasted words; say what the tool actually does

### 4. Write the descriptions

Keep each option short enough for GitHub's About field (aim under 350 characters). Lead with what the software does, not how it is marketed.

## Output

Default behavior: output **exactly two** labeled options.

### Option 1: One-Sentence Impact Punch

Structure: An [adverb] [verb-ing] [noun_type] that [impact clause explaining how it completely eliminates the pain_point].

Example: "A delightfully aggressive caching extension that completely nukes redundant API calls before they hit your database."

### Option 2: Two-Sentence Hook & Play

- Sentence 1: A clever, cutesy metaphor or analogy for what using the repo feels like.
- Sentence 2: It is a [friendly adjective] [noun_type] built to [core_action] without [pain_point].

Example: "Think of it as a personal butler for your messy configuration files. It is a lightweight helper library built to quietly format your environment variables without cluttering your workspace."

Do not add a third option, a rationale essay, or a rewritten README unless the user asked for that.

## Constraints

- Do not invent features, stack choices, or audiences that are not in the input or the repo.
- Do not flatten a multi-purpose repo into a laundry list; describe the primary job.
- Do not use empty corporate phrasing ("synergies," "leverage," "best-in-class," "seamlessly," "robust solution").
- Do not let the metaphor outrun the facts — if the pun needs a paragraph of explanation, drop it.
- If the user specified a custom format or tone, do not also emit the default two options unless they asked for both.
