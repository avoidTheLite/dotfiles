# Prompt: Create PRD

_Portable version of the `idea-to-prd` skill — same instructions, framed as a standalone prompt so it can be handed to an agent context that doesn't support the Skill file format (e.g. pasted as a system/user prompt for another agent or CLI). When running inside Claude with skills enabled, prefer the skill itself in `skills/idea-to-prd/`; this file exists so the same behavior travels outside that system._

## Purpose

Work with the user to scope a single idea, or one chosen path/option from an existing Idea document, into one committed PRD.

## When to use

Trigger on: "turn this into a PRD," "scope this idea," "write the PRD for X," "let's PRD this out," or when the user references an idea doc and wants to move toward something buildable.

Do NOT use this for open-ended brainstorming (that's `Capture Idea` / `idea-capture`), and not for defects, BDD stories, technical/task stories, or agent handoff docs.

## Core principle

Same as `Capture Idea`: don't originate content, organize and challenge what the user gives you. The difference is the *mode* — this flow exists to close down possibility into one buildable scope, not protect it.

- Convergence, not generation. When you hit an unresolved variable or a still-open path, put it to the user directly and get a decision before moving on. A PRD with an unresolved fork in it isn't scoped.
- Still never invent. Forcing a decision means asking which option was meant to be committed to — not proposing a third option or filling a gap with something plausible-sounding. If the user doesn't know yet, log it in Open Questions instead of papering over it.
- One PRD per session. If the user is trying to scope two divergent paths at once, stop and say so — that's two PRDs, or a decision to make first.

## Flow

1. **Establish the source.** Find out what's being scoped: an existing Idea document (pasted, uploaded, or referenced) — if it has multiple top-level paths or unresolved options, ask which path is being scoped before going further — or a freeform idea stated directly, with no prior document. Restate your understanding in a sentence or two and confirm before proceeding.
2. **Walk the PRD sections conversationally**, not as a form dump:
   - Problem statement — what's broken/missing, who feels it. If the user jumps to a solution, ask what problem it solves.
   - Goals / non-goals — non-goals especially need to be asked for directly, since they're rarely stated unprompted.
   - Users / audience.
   - Requirements — elicit one at a time or in batches; number and prioritize (must/should/could). Surface conflicting requirements immediately as a decision to make now.
   - Success metrics — ask if not stated; don't invent one.
   - Dependencies / risks — capture what's stated; ask if anything obvious seems missing rather than listing risks yourself.
3. **Force resolution of anything still open.** If the source Idea document left variables tagged open or a feature-level option unpicked, this is where they get resolved — ask plainly which way to go. Log genuinely unresolved items in Open Questions rather than guessing.
4. **Close and produce the PRD.**

## Output

Read `skills/idea-to-prd/references/templates/prd-template.md` before filling it in — don't reconstruct the structure from memory. Fill it from what's been established in conversation, with nothing invented. Fill "Source idea" with a reference to the originating Idea document and which path/option this PRD scopes, if applicable.

## Notes

- Receives handoffs from: `Capture Idea` (`capture-idea.md` / `idea-capture` skill).
- This prompt only produces the PRD — resist drafting technical approach, task breakdowns, or acceptance-test scenarios here; those belong to later prompts/skills in this same family once they exist.
