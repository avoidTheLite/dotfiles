# Agent Runner Service — Phase 2 Specification

| | |
|---|---|
| **Status** | Draft — open for iteration before implementation handoff |
| **Phase** | Phase 2 of the agent swarm project plan ("Your own runner, manual routing") |
| **Owner** | Developer Persona |
| **Standards baseline** | `identity/workspace-standards.json` (v2.0.0), `config/branch-standards.json` |
| **Source design docs** | `agent-swarm-project-plan.md` (Phase 2 section), `slack-intake-thread-resolution-design.md` |

This document specifies the Node.js service referred to as **the runner** —
a standalone microservice with its own Slack identity (`@runner`) that
routes messages to a backend LLM adapter chosen explicitly by the caller.
It is written to be handed off to an implementing agent as-is; anything left
open is called out explicitly in [§16 Open Design Decisions](#16-open-design-decisions)
rather than silently assumed.

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Out of Scope](#2-out-of-scope)
3. [Terminology](#3-terminology)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Project Conventions](#5-project-conventions)
6. [Command Grammar](#6-command-grammar)
7. [Adapter Interface Contract](#7-adapter-interface-contract)
8. [Context Store](#8-context-store)
9. [Skills Middleware](#9-skills-middleware)
10. [Dispatch Flow](#10-dispatch-flow)
11. [GitHub Issue Bridge](#11-github-issue-bridge)
12. [Logging & the Dispatch Log](#12-logging--the-dispatch-log)
13. [Error Handling & Failure Modes](#13-error-handling--failure-modes)
14. [Security & Secrets](#14-security--secrets)
15. [Testing Strategy](#15-testing-strategy)
16. [Open Design Decisions](#16-open-design-decisions)
17. [Traceability to Phase 2 Exit Criteria](#17-traceability-to-phase-2-exit-criteria)

---

## 1. Purpose & Scope

Build a microservice that:

- Connects to Slack as its own app/bot identity, `@runner`.
- Accepts messages addressed to it via a small CLI-style command grammar.
- Routes each message to **exactly one, explicitly named** backend adapter
  (Claude API or OpenAI API in this phase) — no automatic backend selection.
- Maintains a structured context store per thread so follow-up messages in
  the same thread pull prior decisions/summary from the runner's own store,
  not from Slack's thread history.
- Logs every dispatch decision (intent, skills applied, agent chosen).
- Can, on explicit command, take a finalized thread and file it as a
  labeled GitHub Issue.

This is the Phase 2 deliverable in the four-phase plan: manual routing only,
one runner, no auto-routing intelligence yet.

## 2. Out of Scope

Explicitly deferred to later phases — do not build these now, but the
architecture below is shaped so they slot in without a rewrite:

- **Local model adapter** (OpenWebUI/Ollama) — Phase 3.
- **Automatic routing / decision engine** (complexity heuristics, budget
  polling, local-headroom checks) — Phase 3. The `--agent` flag is always
  required in Phase 2; there is no default-agent fallback.
- **Cursor / Copilot adapters** — Phase 2 explicitly punts this per-task:
  those tools keep using their native Slack apps (Phase 1 path) until a
  concrete case for programmatic control appears. No adapter stubs are
  built for them yet (see [§16.6](#16-open-design-decisions)).
- **Domain knowledge repository, agent memory formalization, promotion
  workflow** — Phase 4.
- **Full closure-action set from the intake/thread-resolution design**
  (`capture`, `promote`, `dispatch`) — only `file-issue` is in scope here,
  because it's the one Phase 2 explicitly calls for (the spec-to-GitHub
  bridge). The others belong to the broader intake design and are not part
  of this runner's Phase 2 surface.
- **Reasoning field on the dispatch log** — the column is reserved (nullable)
  now so Phase 3 doesn't require a migration, but nothing populates it yet.

## 3. Terminology

| Term | Meaning |
|---|---|
| **Runner** | This service; the single Slack identity all commands go through. |
| **Adapter** | A module implementing the common backend interface (§7) for one downstream LLM provider. |
| **Intent** | The free-text task/prompt portion of a command, after flags are stripped. |
| **Skill** | A named middleware function that augments the assembled prompt (system-prompt fragment, formatting rule, persona, etc.). |
| **Thread** | A Slack thread, keyed by `thread_ts`; the unit the context store organizes around. |
| **Dispatch** | One full cycle of: parse → load context → assemble prompt → call adapter → reply → persist. |

## 4. High-Level Architecture

```
                         ┌─────────────────────────┐
  Slack (Socket Mode)◄──►│   Slack Interface Layer  │
                         │   (Bolt app, listeners)  │
                         └────────────┬─────────────┘
                                      │ raw event
                                      ▼
                         ┌─────────────────────────┐
                         │     Command Parser       │  → ValidationError on malformed input
                         └────────────┬─────────────┘
                                      │ ParsedCommand
                                      ▼
                         ┌─────────────────────────┐
                         │       Dispatcher          │◄──────────────┐
                         └───┬─────────┬────────────┘                │
                             │         │                             │
                 load/write  │         │ resolve                     │
                             ▼         ▼                             │
                 ┌───────────────┐ ┌───────────────┐        ┌────────┴────────┐
                 │ Context Store  │ │ Skills Registry│        │ Dispatch Logger │
                 │ (SQLite)       │ │ (middleware)   │        │ (Pino + table)  │
                 └───────────────┘ └───────┬────────┘        └─────────────────┘
                                            │ augmented prompt
                                            ▼
                                  ┌───────────────────┐
                                  │   Adapter Layer     │
                                  │ (Claude | OpenAI)   │
                                  └──────────┬──────────┘
                                             │ reply text
                                             ▼
                                  posted back into the Slack thread

                 (side channel, control-verb command)
                 ┌─────────────────────────┐
                 │  GitHub Issue Bridge      │◄── `@runner file-issue [repo]`
                 └─────────────────────────┘

  ┌─────────────────────────┐
  │  Minimal Express ops app │  (health/readiness only — no Slack traffic
  │  (/healthz, /readyz)     │   flows over HTTP; Socket Mode needs no
  └─────────────────────────┘   public URL)
```

**Components:**

- **Slack Interface Layer** — Bolt app in Socket Mode. Listens for
  `app_mention` events (and thread replies where the runner already
  participated — see [§16.2](#16-open-design-decisions)). Ignores everything else.
- **Command Parser** — turns raw mention text into a `ParsedCommand`
  (intent text, `skills: string[]`, `agent: string`, or a recognized
  control verb). Pure function, fully unit-testable without Slack.
- **Dispatcher** — the orchestrator; the only component that knows the
  full sequence in [§10](#10-dispatch-flow).
- **Context Store** — SQLite-backed repository behind an interface, keyed
  by `thread_ts` (see [§8](#8-context-store)).
- **Skills Registry** — a lookup of skill name → middleware function
  (see [§9](#9-skills-middleware)).
- **Adapter Layer** — Claude and OpenAI adapters behind a common interface
  (see [§7](#7-adapter-interface-contract)).
- **Dispatch Logger** — writes a `dispatch_log` row and emits a structured
  Pino log line for every completed dispatch.
- **GitHub Issue Bridge** — invoked only by the `file-issue` control verb;
  not part of the adapter-dispatch path.
- **Ops Express app** — a thin Express 5 app for container health checks
  only, per [§5](#5-project-conventions). It carries no Slack or LLM traffic.

## 5. Project Conventions

Drawn directly from `identity/workspace-standards.json`. Where the runner's
context (a home-lab, Socket-Mode service) genuinely diverges from a global
default, the deviation is called out and justified — nothing here silently
ignores the standards file.

- **Runtime:** Node.js 22, package manager pnpm.
- **Language:** TypeScript, strict mode (`strictNullChecks`, `noImplicitAny`),
  fully ESM (`"type": "module"`), NodeNext module resolution, mandatory
  `.ts` extensions on relative imports, `node:` protocol for built-ins.
- **Repo shape:** single standalone package, **not** a pnpm+Turborepo
  monorepo. Phase 2 has one deployable surface (the runner itself); the
  monorepo/workspace conventions in the standards file apply if/when this
  splits into multiple packages (e.g. adapters extracted to their own
  package) — no need to pay that structural cost now.
- **Linting/formatting:** ESLint flat config
  (`@eslint/js` + `typescript-eslint` + `eslint-plugin-import` +
  `eslint-plugin-n` + `eslint-config-prettier`); Prettier with
  `semi: true, singleQuote: true, trailingComma: 'all', printWidth: 100, tabWidth: 2`.
- **Exports:** named exports only; default exports are not used
  anywhere in this service. Exported functions declare explicit return types.
- **App assembly (`node_server_conventions`):** `app.ts` creates and
  exports the Express app (ops-only, see §4); `index.ts` imports it,
  calls `.listen()`, **and** starts the Bolt Socket Mode connection. This
  keeps the Express app importable in tests without opening a port or a
  socket.
- **Routing:** one `*Router.ts` per HTTP domain. In this service there is
  exactly one: `healthRouter.ts`, mounted at `/`.
- **Controllers:** factory functions returning an object of handler
  methods, per convention, even for the two health endpoints.
- **Middleware:** `bodyParser.json()` per-router (not global — there is
  effectively no JSON body traffic on the ops app, but the rule is kept for
  consistency if endpoints are added later); `cors()` global; request
  logging global; `errorHandler` registered last.
- **Logging:** Pino via a thin local wrapper (`src/logger.ts`, mirroring
  the `@battleship/util` pattern from the standards example). No
  `console.log` in application code. `pino-pretty` piped in for local dev
  only. Log levels used per the standard table (fatal/error/warn/info/debug/trace).
- **Error handling:** no `try/catch` in Bolt listeners or route handlers;
  throw `AppError` subclasses and let a single centralized handler manage
  logging + response/reply formatting. Bolt's own global error handler
  (`app.error()`) fills the equivalent role for Slack-originated errors;
  the Express `errorHandler` (registered last) fills it for the ops app.
- **Environment config:** validated at startup with Zod
  (`src/config.ts`), `dotenv/config` populates `process.env`, Zod parses
  and coerces immediately, app fails fast on a bad/missing var. See §14
  for the required variable list.
- **Testing:** Vitest, `environment: 'node'`, 80% minimum coverage target,
  applied to parser, adapters (mocked), context store, and dispatcher.
- **Git workflow:** GitHub Flow — base branch `main`, one branch per task,
  atomic commits, squash merge, PR opened against `main` following
  `.github/PULL_REQUEST_TEMPLATE.md` on completion. Branch prefix is one of
  `feature/ | fix/ | chore/ | docs/` + kebab-case slug per
  `config/branch-standards.json`.
- **Security:** least privilege, input validation at every boundary,
  strict env segregation (dev/test/prod secrets never shared), no real
  secrets committed (gitleaks-enforced), fake values only in docs/examples.
- **Accessibility bar (WCAG 2.2 AA):** not applicable — this service has no
  UI surface (Slack is the UI, rendered by Slack's own client).
- **Called-out deviation — cloud infrastructure:** the standards file
  defaults to AWS/Terraform/Docker/GitHub Actions. The Phase 2 plan is
  explicit that this runner lives on a home lab box and uses Slack **Socket
  Mode specifically so no public URL/ingress is required.** Terraform/AWS
  is not applicable to a single self-hosted process. **Docker is still
  used** for the container image (parity with the standards'
  containerization convention and for reproducible home-lab deployment),
  but there is no cloud provisioning step. See [§16.7](#16-open-design-decisions).

## 6. Command Grammar

The Phase 2 plan's Tasks section and Exit Criteria section state the syntax
two different ways (`--agent=z` flag vs. `agent:` prefix shorthand). This
spec resolves that fork rather than leaving it ambiguous (flagged, not
guessed silently — see [§16.1](#16-open-design-decisions)): **the flag form is
canonical; the colon-prefix form is a supported shorthand alias that
parses to the same `ParsedCommand`.**

**Canonical form:**

```
@runner <intent text> --agent=<name> [--skill=<name>[,<name>...]]
```

**Shorthand alias** (equivalent to the above when the first token before
the intent text ends in `:` and matches a known agent name):

```
@runner <agent>: <intent text>
```

**Control verbs** — a small fixed set of non-adapter commands, matched
before falling back to intent-dispatch parsing:

```
@runner file-issue [repo]
@runner help
```

**Grammar (informal EBNF):**

```
command       ::= mention WS ( control-verb | dispatch )
mention       ::= "@runner"
control-verb  ::= "file-issue" (WS repo-slug)? | "help"
dispatch      ::= shorthand-form | canonical-form
shorthand-form::= agent-name ":" WS intent-text (WS flag)*
canonical-form::= intent-text (WS flag)*
flag          ::= "--agent=" agent-name | "--skill=" skill-list
agent-name    ::= /[a-z0-9-]+/
skill-list    ::= skill-name ("," skill-name)*
skill-name    ::= /[a-z0-9-]+/
intent-text   ::= /.+/   (free text; flags are stripped out of it, not embedded)
```

**Parsing rules:**

- Flags may appear anywhere in the message; the parser strips them out and
  what remains (trimmed) is `intent`.
- `--agent` (or the shorthand) is **required** for dispatch commands — there
  is no default agent in Phase 2. Missing it is a `ValidationError`
  ("Phase 2 requires an explicit `--agent=`; automatic routing isn't built
  yet.").
- `--agent` must name an adapter registered in the Adapter Layer (§7) or
  the parser throws `ValidationError` listing the currently registered
  adapter names.
- `--skill` is optional; unknown skill names are a `ValidationError`
  listing registered skill names (fail closed — silently ignoring a typo'd
  skill would be worse than telling the caller).
- Control verbs take priority over dispatch parsing — `file-issue` and
  `help` are reserved words and cannot double as agent names.
- On any `ValidationError`, the runner replies **in-thread** with the error
  message and does **not** call an adapter, write a dispatch-log row, or
  mutate context-store state (a rejected command is a no-op past the
  reply).

**Examples:**

| Input | Parses to |
|---|---|
| `@runner draft a spec for the retry policy --agent=claude` | `{intent: "draft a spec for the retry policy", agent: "claude", skills: []}` |
| `@runner claude: draft a spec for the retry policy` | same as above |
| `@runner cursor: fix the auth bug` | `ValidationError` — `cursor` is not a registered adapter in Phase 2 (see §2) |
| `@runner summarize this thread --agent=openai --skill=terse,markdown` | `{intent: "summarize this thread", agent: "openai", skills: ["terse", "markdown"]}` |
| `@runner file-issue avoidTheLite/dotfiles` | control verb, routed to the GitHub Issue Bridge, no adapter involved |

## 7. Adapter Interface Contract

All backends implement one interface. The runner's dispatcher only ever
talks to this shape — it has no branch logic per provider.

```ts
// src/adapters/types.ts

export interface AdapterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AdapterRequest {
  messages: AdapterMessage[];   // fully assembled by the dispatcher/skills
                                  // layer before this call — adapters do not
                                  // pull context themselves.
  metadata: {
    threadTs: string;
    skillsApplied: string[];
  };
}

export interface AdapterResponse {
  text: string;
  raw: unknown;                  // provider's raw response, for logging/debug only
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface Adapter {
  readonly name: string;         // registry key, e.g. "claude", "openai"
  invoke(request: AdapterRequest): Promise<AdapterResponse>;
}
```

- **Adapter registry** (`src/adapters/index.ts`) is a `Record<string, Adapter>`
  built at startup. The command parser and dispatcher validate `--agent`
  against this registry's keys — the registry is the single source of
  truth for "what agent names are valid," not a hardcoded list in the parser.
- **Claude adapter** — wraps the Anthropic Messages API. The API is
  stateless per call, so this adapter's `invoke()` is responsible for
  nothing more than shipping the already-assembled `messages` array
  through; it does **not** reconstruct history itself — that's the
  dispatcher's job via the context store (§8), keeping the adapter thin
  and swappable.
- **OpenAI adapter** — wraps the OpenAI Chat Completions (or Responses)
  API with the same shape. Same statelessness assumption.
- **Adding a fifth provider later** (per the plan's guiding architecture)
  means writing one new file implementing `Adapter` and registering it —
  no change to the parser, dispatcher, or context store.

## 8. Context Store

SQLite to start (per the Phase 2 plan explicitly), behind a repository
interface so swapping to Postgres later (per Phase 4/scale needs) touches
one file, not the dispatcher.

```ts
// src/context/types.ts

export interface ThreadRecord {
  threadTs: string;
  channelId: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface ContextEntry {
  id: number;
  threadTs: string;
  agent: string;           // which adapter produced this, or "user"
  summary: string;         // compacted, not full transcript
  createdAt: string;
}

export interface ContextStore {
  getThread(threadTs: string): Promise<ThreadRecord | undefined>;
  upsertThread(record: Omit<ThreadRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  appendEntry(entry: Omit<ContextEntry, 'id' | 'createdAt'>): Promise<void>;
  getRecentEntries(threadTs: string, limit: number): Promise<ContextEntry[]>;
  markResolved(threadTs: string): Promise<void>;
}
```

**Schema (SQLite DDL):**

```sql
CREATE TABLE threads (
  thread_ts   TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE context_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_ts   TEXT NOT NULL REFERENCES threads(thread_ts),
  agent       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_context_entries_thread_ts ON context_entries(thread_ts);

CREATE TABLE dispatch_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_ts      TEXT NOT NULL REFERENCES threads(thread_ts),
  intent         TEXT NOT NULL,
  skills_applied TEXT NOT NULL DEFAULT '[]',   -- JSON array
  agent_chosen   TEXT NOT NULL,
  reasoning      TEXT,                          -- reserved for Phase 3; NULL in Phase 2
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dispatch_log_thread_ts ON dispatch_log(thread_ts);
```

- **Read path:** the dispatcher calls `getRecentEntries(threadTs, N)` and
  builds the `AdapterMessage[]` from those compacted summaries plus the
  current intent — **not** from Slack's `conversations.replies`. `N` is
  configurable (see [§16.8](#16-open-design-decisions) for the default).
- **Write path:** after a successful adapter call, the dispatcher writes
  one `context_entries` row (`agent: <the adapter name>`, `summary:` a
  compacted version of the reply — not the raw text verbatim if it's long)
  and updates `threads.updated_at`.
- **Compaction:** Phase 2 keeps compaction simple — truncate/summarize
  server-side to a fixed max length before writing the entry, rather than
  storing full transcripts. A dedicated summarization pass is a Phase 4
  concern (memory formalization); Phase 2 just needs "don't grow
  unbounded" (see [§16.8](#16-open-design-decisions)).

## 9. Skills Middleware

Skills are the "middleware" axis from the guiding architecture — they must
work identically regardless of which adapter is chosen (this is the actual
test of a clean abstraction, called out explicitly for Phase 3, but the
seam needs to exist starting now).

```ts
// src/skills/types.ts

export interface SkillContext {
  threadTs: string;
  intent: string;
}

export type Skill = (
  systemPrompt: string,
  context: SkillContext,
) => string; // returns the augmented system prompt

export interface SkillRegistry {
  [name: string]: Skill;
}
```

- The dispatcher folds requested skills over a base system prompt in the
  order listed in `--skill=`, before handing the final `messages` array to
  the adapter.
- Skills are provider-agnostic by construction — they only ever see/return
  a system-prompt string, never a provider-specific request shape.
- Phase 2 ships a minimal registry (exact starter set is an open decision,
  [§16.5](#16-open-design-decisions)) — the point of this phase is that the
  seam exists and is exercised by at least one real skill, not that the
  skill library is complete.

## 10. Dispatch Flow

Step-by-step, for a single incoming Slack event:

1. **Receive** — Bolt event listener fires on `app_mention` (and qualifying
   thread replies, [§16.2](#16-open-design-decisions)). Non-matching events
   are ignored before any parsing happens.
2. **Parse** — raw text → `ParsedCommand` (§6). Malformed input short-circuits
   here: reply with the validation error, stop (no logging, no context write).
3. **Control-verb branch** — if the command is `file-issue` or `help`,
   hand off to that command's handler (§11) and stop; this bypasses the
   adapter/skills/context path entirely.
4. **Load context** — `contextStore.getThread(threadTs)`; create the
   thread record if absent. `contextStore.getRecentEntries(threadTs, N)`.
5. **Resolve skills** — look up each requested skill name in the registry
   (already validated to exist at parse time); fold them over the base
   system prompt in order.
6. **Assemble messages** — compacted history entries + current intent become
   the `AdapterMessage[]` per the adapter contract (§7).
7. **Resolve adapter** — look up `--agent` in the adapter registry (already
   validated to exist at parse time).
8. **Invoke** — `adapter.invoke(request)`. See [§13](#13-error-handling--failure-modes)
   for timeout/failure handling.
9. **Log the dispatch decision** — one `dispatch_log` row
   (`intent, skills_applied, agent_chosen`, `reasoning: null`) plus a
   structured Pino `info` log line, written **regardless of adapter
   success or failure** (failures log at `warn`/`error` with the failure
   reason instead of a reply summary).
10. **Reply** — post the adapter's `text` back into the Slack thread,
    prefixed with which agent answered (e.g. `*[claude]*`).
11. **Write back** — `contextStore.appendEntry(...)` with a compacted
    version of the reply; update `threads.updated_at`.

## 11. GitHub Issue Bridge

Implements the one closure action from the intake/thread-resolution design
that Phase 2 explicitly calls for: *"Wire the spec-to-GitHub-issue bridge:
when a thread produces a finalized spec, runner can file it as a labeled
GitHub Issue."*

- **Trigger:** `@runner file-issue [repo]` control verb (§6).
- **Input:** all `context_entries` for the thread, compacted into an issue
  body (title derived from the first entry or an explicit override —
  exact heuristic is an open decision, [§16.4](#16-open-design-decisions)).
- **Action:** creates a GitHub Issue via the GitHub API (Octokit) in the
  named repo (or a configured default repo if `[repo]` is omitted —
  [§16.4](#16-open-design-decisions)), applies a fixed label (e.g.
  `from-runner`) so filed issues are identifiable, and posts the issue URL
  back into the Slack thread.
- **Closure semantics:** per the thread-resolution design, marks the
  thread `resolved` (`contextStore.markResolved`) as the side effect of a
  real closure action — not a bare label applied for its own sake.
- **Scope boundary:** this is the *only* closure action Phase 2 implements.
  `capture`, `promote`, and `dispatch` from the intake design are out of
  scope here (§2) — they belong to that broader design's own workstream.

## 12. Logging & the Dispatch Log

- Every dispatch (successful or failed) produces:
  - a structured Pino JSON log line (fields: `threadTs`, `intent`,
    `skillsApplied`, `agentChosen`, `outcome`), and
  - a `dispatch_log` row (§8), which is what makes "log every dispatch
    decision" queryable rather than just grep-able in log files.
- The `reasoning` column exists now, nullable, specifically so Phase 3's
  auto-routing work extends this table rather than migrating it.
- Log levels follow the standard table in §5 — dispatch success is `info`,
  a parser rejection is `warn` (expected/operational), an adapter failure
  is `error` if unexpected or `warn` if it's a known/operational condition
  (e.g. rate limit — see §13).

## 13. Error Handling & Failure Modes

Custom error classes extend a shared `AppError` (mirroring the standards
file's pattern), each carrying a `statusCode`-equivalent classification
even though most of this service's errors surface as Slack replies rather
than HTTP responses:

```ts
export class AppError extends Error {
  constructor(message: string, public readonly isOperational = true) {
    super(message);
  }
}

export class ValidationError extends AppError {}      // bad command syntax, unknown agent/skill
export class AdapterError extends AppError {}          // downstream provider failure
export class ContextStoreError extends AppError {}     // persistence failure
```

| Failure | Handling |
|---|---|
| Malformed command / unknown `--agent` / unknown `--skill` | `ValidationError` → reply in-thread with the specific reason, no dispatch-log row, no context write (§6). |
| Adapter timeout or 5xx | One retry with backoff (exact policy: [§16.9](#16-open-design-decisions)); if still failing, `AdapterError` → apologetic in-thread reply, dispatch-log row written with `outcome: "adapter_error"` so the failure itself is queryable. |
| Adapter rate limit (429) | Treated as operational (`warn`, not `error`); same reply/logging path as above, distinct `outcome` value so Phase 3's budget-polling work can query specifically for these. |
| Context store unavailable at read time | `ContextStoreError` → fail closed: reply "context temporarily unavailable, try again" rather than silently dispatching with no history. |
| Context store unavailable at write time (post-dispatch) | Reply still goes out (the user gets their answer); write failure is logged at `error` but does not re-surface to Slack — a lost compaction write is recoverable, a lost reply is not. |
| Slack API failure posting the reply | Logged at `error`; no further retry loop in Phase 2 (avoids duplicate replies) — flagged as acceptable manual-recovery behavior for this phase. |

## 14. Security & Secrets

- **Slack:** `SLACK_APP_TOKEN` (Socket Mode) and `SLACK_BOT_TOKEN`,
  provisioned with least-privilege scopes — `app_mentions:read`,
  `chat:write`, and `channels:history`/`groups:history` only if thread
  history is ever read directly from Slack (it currently isn't; the
  runner reads its own context store — see §8). Scopes are re-evaluated
  before implementation, not assumed.
- **Adapters:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — provider keys only,
  never bundled with any other secret in the same variable.
- **GitHub:** a token scoped to `repo`/`issues:write` for the target
  repo(s) the issue bridge is allowed to file into.
- **All secrets** loaded via `.env` locally (gitignored) and validated by
  the Zod env schema at boot (§5) — the app fails fast rather than running
  with an unset/malformed secret. No real secrets ever committed; fake
  values only (`sk-test-...`, `REDACTED`) in examples/docs. Gitleaks
  enforced in CI per the standards file.
- **Env segregation:** dev/test/prod use distinct env files/secret stores;
  never shared across environments.

## 15. Testing Strategy

Vitest, `environment: 'node'`, 80% minimum coverage per the standards file,
applied per component:

- **Command parser** — pure-function unit tests: canonical form, shorthand
  alias, control verbs, every validation-error branch in §6's table,
  including the ambiguous cases (e.g. an agent name colliding with a
  control verb).
- **Adapters** — unit tests against a mocked HTTP layer (no live API calls
  in CI); contract tests asserting every adapter satisfies the `Adapter`
  interface shape and returns `AdapterResponse` on success / throws
  `AdapterError` on provider failure.
- **Context store** — tests against a real in-memory/temp-file SQLite
  instance (not mocked), covering `upsertThread`, `appendEntry`,
  `getRecentEntries` ordering/limit, and `markResolved`.
- **Dispatcher** — integration-style tests wiring a fake adapter + real
  (temp) context store + real parser, asserting the full flow in §10
  end-to-end, including that a `ValidationError` produces zero context
  writes and zero dispatch-log rows.
- **GitHub issue bridge** — unit tests against a mocked Octokit client,
  asserting the correct repo/label/body and that `markResolved` is called
  only on success.

## 16. Open Design Decisions

Per this workspace's convergence discipline (don't invent, don't leave a
fork silently resolved) — these are flagged for explicit sign-off before
implementation, not guessed:

1. **Command syntax fork** — resolved in this draft as flag-canonical +
   colon-shorthand alias (§6). Confirm this reading of the plan is what
   was intended, since the plan's own two sections state it two ways.
2. **Trigger surface** — does the runner only respond to top-level
   `app_mention`s, or also to any reply *within* a thread it has already
   participated in (so a user doesn't have to re-mention `@runner` on every
   turn)? The Phase 2 exit criteria ("follow-ups in that thread correctly
   pulling prior context") implies the latter but doesn't say explicitly.
3. **DMs** — does `@runner` respond in direct messages, or channels/threads
   only?
4. **GitHub issue bridge target repo & title heuristic** — is there a
   default repo when `[repo]` is omitted, and how is the issue title
   derived from thread content (first message? last summary? explicit
   `--title=`?).
5. **Starter skill set** — Phase 2 needs at least one real skill exercised
   through the registry; which one(s) ship on day one (e.g. `terse`,
   `markdown-only`, a persona skill)?
6. **Cursor/Copilot posture** — plan says "decide per-task" whether to keep
   routing to their native Slack apps or call their APIs directly. This
   spec assumes **native apps only** for Phase 2 (§2) — confirm, since it
   affects whether the adapter registry needs placeholder entries at all.
7. **Deployment target specifics** — confirm the home-lab host/container
   runtime (bare Docker? Compose? something already standardized
   elsewhere in this dotfiles repo?) so §5's Docker-without-Terraform
   posture is concretely actionable rather than just "not AWS."
8. **History depth (`N`)** — how many compacted `context_entries` get
   pulled per dispatch, and what's the max length a single compacted entry
   is truncated/summarized to?
9. **Retry/backoff policy** — exact attempt count and backoff curve for
   adapter timeouts/5xx (§13) — a number needs picking, not just "some
   retry."

## 17. Traceability to Phase 2 Exit Criteria

| Plan requirement | Where covered |
|---|---|
| Own Slack identity, Bolt + Socket Mode, no public URL | §4, §5 |
| CLI-style syntax `@runner [intent] --skill=x,y --agent=z` | §6 |
| Claude API adapter (stateless, full `messages` array per call) | §7 |
| OpenAI API adapter | §7 |
| Cursor/Copilot: native-app routing decided, not forced | §2, §16.6 |
| Context store (SQLite/Postgres), keyed by `thread_ts`/task id | §8 |
| Parse intent+flags → context slice → assemble system prompt (skills as middleware) → call adapter → post reply → write back compacted summary | §9, §10 |
| Spec-to-GitHub-issue bridge | §11 |
| Log every dispatch decision (intent, skills, agent chosen) | §12 |
| `@runner claude: draft a spec for X` and `@runner cursor: fix the auth bug` both work from the same thread; follow-ups pull prior context from the runner's own store | §6 (shorthand), §8, §16.2 note on `cursor` specifically resolving to a `ValidationError` in this draft (§2) rather than a working adapter — flagged as a literal reading of the exit-criteria example versus the Phase-2 scope decision in §2, and called out for sign-off in §16.6 |

---

_This document is a draft for iteration. Once open items in §16 are
resolved, this file is the handoff artifact for the implementing agent —
no further scope should need inventing at implementation time._
