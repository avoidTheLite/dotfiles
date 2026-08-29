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
open is called out explicitly in [§18 Open Design Decisions](#18-open-design-decisions)
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
12. [Thread Closure & Resolution Signal](#12-thread-closure--resolution-signal)
13. [Async Completion Follow-up](#13-async-completion-follow-up)
14. [Logging & the Dispatch Log](#14-logging--the-dispatch-log)
15. [Error Handling & Failure Modes](#15-error-handling--failure-modes)
16. [Security & Secrets](#16-security--secrets)
17. [Testing Strategy](#17-testing-strategy)
18. [Open Design Decisions](#18-open-design-decisions)
19. [Traceability to Phase 2 Exit Criteria](#19-traceability-to-phase-2-exit-criteria)

---

## 1. Purpose & Scope

Build a microservice that:

- Connects to Slack as its own app/bot identity, `@runner`.
- Accepts messages addressed to it via a small CLI-style command grammar.
- **Requires the backend adapter as an explicit input on every dispatch** —
  the caller always names exactly one adapter (Claude, OpenAI, Cursor, or
  Copilot in this phase); there is **no automatic backend selection at this
  time** (see Phase 3 for the decision engine that changes this).
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
  required in Phase 2; there is no default-agent fallback. Phase 2 does
  capture the manual mental model this engine should eventually build on
  — see [§7](#7-adapter-interface-contract)'s routing philosophy note.
- **Cross-adapter fallback on failure** (e.g. retrying a failed dispatch
  against a *different* adapter — a local model, or another cloud agent) —
  Phase 3. Because Phase 2 always requires an explicit `--agent`, there is
  never an "unspecified adapter" case to fall back from; this only becomes
  meaningful once Phase 3 introduces default/auto-selected adapters. See
  [§15](#15-error-handling--failure-modes).
- **Thread watch mode** — an optional parameter (e.g. `--watch`) that would
  let `@runner` keep responding to every reply in a thread it has already
  participated in, without being re-mentioned each turn — Phase 3. Phase 2
  only responds to direct `@runner` mentions (and DMs); see
  [§6](#6-command-grammar).
- **Automatic knowledge-repo subfolder classification** — deciding whether a
  filed issue belongs under `/knowledge/_shared` vs a specific
  `/knowledge/{product-or-subdomain}` path in avoidTheLite/dkr — Phase 3/4.
  Phase 2's issue bridge files a generic, un-triaged issue when no repo is
  given; see [§11](#11-github-issue-bridge).
- **Domain knowledge repository, agent memory formalization, promotion
  workflow** — Phase 4.
- **Full closure-action set from the intake/thread-resolution design**
  (`capture`, `promote`, `dispatch`) — only `file-issue` is in scope here,
  because it's the one Phase 2 explicitly calls for (the spec-to-GitHub
  bridge). The others belong to the broader intake design and are not part
  of this runner's Phase 2 surface.
- **Reasoning field on the dispatch log** — the column is reserved (nullable)
  now so Phase 3 doesn't require a migration, but nothing populates it yet.
- **Closure-recommendation UX** (the checkmark-reaction confirmation loop
  and the `Thread complete - resolve thread?` message) — Phase 3, once
  closure rules exist to decide *when* to trigger it. Phase 2's baseline
  behavior and the full forward design are in
  [§12](#12-thread-closure--resolution-signal).
- **Resolution-criteria checklist mechanism** (how a thread states/tracks
  what "done" means) — Phase 3, alongside the closure-recommendation UX
  above; see [§12](#12-thread-closure--resolution-signal) and
  [§18.11](#18-open-design-decisions).

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
                                  ┌───────────────────────────┐
                                  │       Adapter Layer         │
                                  │ (Claude | OpenAI | Cursor |  │
                                  │         Copilot)             │
                                  └──────────┬──────────────────┘
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
  top-level `app_mention` events and direct messages (DMs) to `@runner`.
  Does **not** respond to unmentioned replies within a thread in Phase 2 —
  every dispatch requires a direct mention (or a DM); a "watch this thread"
  opt-in mode that would remove that requirement is deferred to Phase 3
  (see [§2](#2-out-of-scope) and [§18.2](#18-open-design-decisions)).
  Ignores everything else.
- **Command Parser** — turns raw mention text into a `ParsedCommand`
  (intent text, `skills: string[]`, `agent: string`, or a recognized
  control verb). Pure function, fully unit-testable without Slack.
- **Dispatcher** — the orchestrator; the only component that knows the
  full sequence in [§10](#10-dispatch-flow).
- **Context Store** — SQLite-backed repository behind an interface, keyed
  by `thread_ts` (see [§8](#8-context-store)).
- **Skills Registry** — a lookup of skill name → middleware function
  (see [§9](#9-skills-middleware)).
- **Adapter Layer** — Claude, OpenAI, Cursor, and Copilot adapters behind a
  common interface (see [§7](#7-adapter-interface-contract)). All four are
  in scope for Phase 2 — the runner calls Cursor's and Copilot's APIs
  directly rather than only routing to their native Slack apps, since
  nothing prevents calling them directly today.
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
  and coerces immediately, app fails fast on a bad/missing var. See §16
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
  but there is no cloud provisioning step.
- **Deployment shape (resolved, [§18.8](#18-open-design-decisions)):** Phase
  2 ships the runner as a single Docker image, run standalone
  (`docker run`) — the same low-ceremony approach planned for the
  Phase 3 local-model stack, which will start from the stock OpenWebUI
  Docker image before anything is composed. A self-authored
  `docker-compose.yml` that orchestrates the runner alongside the
  local-model stack is the anticipated next step once Phase 3 lands, but
  is not a Phase 2 requirement — a bare `Dockerfile` + run instructions are
  sufficient here.

## 6. Command Grammar

The Phase 2 plan's Tasks section and Exit Criteria section state the syntax
two different ways (`--agent=z` flag vs. `agent:` prefix shorthand). This
spec resolves that fork rather than leaving it ambiguous (flagged, not
guessed silently — see [§18.1](#18-open-design-decisions)): **the flag form is
canonical; the colon-prefix form is a supported shorthand alias that
parses to the same `ParsedCommand`.**

**Canonical form:**

```
@runner <intent text> --agent=<name> [--skill=<name>[,<name>...]] [--history=<n>]
```

**Shorthand alias** (equivalent to the above when the first token before
the intent text ends in `:` and matches a known agent name):

```
@runner <agent>: <intent text> [--skill=<name>[,<name>...]] [--history=<n>]
```

**Control verbs** — a small fixed set of non-adapter commands, matched
before falling back to intent-dispatch parsing:

```
@runner file-issue [repo] [--title=<text>]
@runner help
```

**Grammar (informal EBNF):**

```
command       ::= mention WS ( control-verb | dispatch )
mention       ::= "@runner"
control-verb  ::= "file-issue" (WS repo-slug)? (WS title-flag)? | "help"
dispatch      ::= shorthand-form | canonical-form
shorthand-form::= agent-name ":" WS intent-text (WS flag)*
canonical-form::= intent-text (WS flag)*
flag          ::= "--agent=" agent-name | "--skill=" skill-list | "--history=" digits
title-flag    ::= "--title=" quoted-text
agent-name    ::= /[a-z0-9-]+/
skill-list    ::= skill-name ("," skill-name)*
skill-name    ::= /[a-z0-9-]+/
digits        ::= /[0-9]+/
quoted-text   ::= /.+/   (free text, not stripped from surrounding intent — file-issue has no separate intent field)
intent-text   ::= /.+/   (free text; flags are stripped out of it, not embedded)
```

**Parsing rules:**

- Flags may appear anywhere in the message; the parser strips them out and
  what remains (trimmed) is `intent`.
- `--agent` (or the shorthand) is **required** for dispatch commands — there
  is no default agent in Phase 2. Missing it is a `ValidationError`
  ("Phase 2 requires an explicit `--agent=`; automatic routing isn't built
  yet.").
- `--agent` must name an adapter registered in the Adapter Layer (§7) — one
  of `claude`, `openai`, `cursor`, `copilot` in this phase — or the parser
  throws `ValidationError` listing the currently registered adapter names.
- `--skill` is optional; unknown skill names are a `ValidationError`
  listing registered skill names (fail closed — silently ignoring a typo'd
  skill would be worse than telling the caller).
- `--history=<n>` is optional and overrides the configured default context
  depth for this dispatch only (see [§8](#8-context-store)); a non-numeric
  or out-of-range value is a `ValidationError`.
- Control verbs take priority over dispatch parsing — `file-issue` and
  `help` are reserved words and cannot double as agent names.
- `--title=<text>` is only valid on `file-issue` and is optional — when
  omitted, the issue title is synthesized by the `issue-title` skill
  rather than left blank; see [§9](#9-skills-middleware) and
  [§11](#11-github-issue-bridge).
- On any `ValidationError`, the runner replies **in-thread** with the error
  message and does **not** call an adapter, write a dispatch-log row, or
  mutate context-store state (a rejected command is a no-op past the
  reply).
- The runner only parses commands from **direct `@runner` mentions and
  DMs** — not from unmentioned replies within a thread (see
  [§4](#4-high-level-architecture) and [§18.2](#18-open-design-decisions)).

**Examples:**

| Input | Parses to |
|---|---|
| `@runner draft a spec for the retry policy --agent=claude` | `{intent: "draft a spec for the retry policy", agent: "claude", skills: []}` |
| `@runner claude: draft a spec for the retry policy` | same as above |
| `@runner cursor: fix the auth bug` | `{intent: "fix the auth bug", agent: "cursor", skills: []}` — dispatched to the Cursor adapter (§7) |
| `@runner summarize this thread --agent=openai --skill=terse,markdown` | `{intent: "summarize this thread", agent: "openai", skills: ["terse", "markdown"]}` |
| `@runner summarize this thread --agent=openai --history=3` | same as above, but only the 3 most recent context entries are pulled instead of the configured default |
| `@runner file-issue avoidTheLite/dotfiles` | control verb, routed to the GitHub Issue Bridge, no adapter involved |
| `@runner file-issue dotfiles` | control verb; bare repo name, resolves to avoidTheLite/dotfiles (see §11) |
| `@runner file-issue` | control verb; no repo given, resolves to the avoidTheLite/dkr default (see §11) |

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
  asyncTaskId?: string;           // present only for async-capable adapters (Cursor, Copilot) — see §13
}

export interface AsyncTaskStatus {
  state: 'pending' | 'completed' | 'failed';
  resultText?: string;
}

export interface Adapter {
  readonly name: string;         // registry key, e.g. "claude", "openai"
  invoke(request: AdapterRequest): Promise<AdapterResponse>;
  checkStatus?(externalTaskId: string): Promise<AsyncTaskStatus>;  // only Cursor/Copilot implement this — see §13
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
- **Cursor adapter** — wraps Cursor's Background Agents API directly
  (rather than routing through Cursor's native Slack app), since it's
  callable directly today and there's no reason to keep it off the
  registry. **Important asymmetry:** unlike Claude/OpenAI, a Cursor
  background agent run is asynchronous — dispatching it kicks off a task
  against a repo/branch that completes (e.g. opens a PR) sometime later.
  `invoke()` therefore returns an **acknowledgment**
  (`AdapterResponse.text` — a confirmation plus a tracking link — and
  `AdapterResponse.asyncTaskId`) rather than a completed answer. Surfacing
  the eventual completion back into the Slack thread is handled by the
  polling design in [§13](#13-async-completion-follow-up).
- **Copilot adapter** — wraps the GitHub Copilot coding agent API directly
  (e.g. assigning a task/issue to the coding agent) for the same reason:
  it's directly callable, so it goes in the registry rather than being
  deferred. Same asynchronous acknowledgment pattern as the Cursor adapter
  above.
- **Adding a fifth provider later** (per the plan's guiding architecture)
  means writing one new file implementing `Adapter` and registering it —
  no change to the parser, dispatcher, or context store.

**Routing philosophy — captured for Phase 3, resolved as documentation
only ([§18.12](#18-open-design-decisions)):** Phase 2 still requires
`--agent` explicitly on every dispatch (§1) — nothing below changes that.
This exists so the mental model you already use manually is written down
before Phase 3 builds an auto-routing decision engine on top of it, rather
than that engine inventing a heuristic from scratch:

- **Cursor and Copilot** — coding tasks against well-defined work (a
  scoped bug fix, a described feature) that a background coding agent can
  just go implement. Currently split between the two mainly to spread
  token/usage budget across providers, not because of a hard capability
  difference — a more principled split (by repo, task type, or provider
  strength) is plausible once there's evidence to base it on (§14).
- **Claude** — back-and-forth conversational work: talking through a
  problem, drafting and iterating specs (this document is an instance of
  that pattern), anything where the human stays in the loop turn-by-turn
  rather than handing off a self-contained task.
- **OpenAI** — no settled usage pattern yet; open for experimentation.
- **Local model (Phase 3, doesn't exist yet)** — expected to slot in
  wherever cost, latency, or privacy favor a self-hosted model over a
  cloud call, once it exists.

The design implication for Phase 3: the eventual decision engine should
route based on each adapter's actual strengths and constraints — e.g. the
synchronous vs. asynchronous response shape above, coding-agent vs.
chat-model posture — rather than normalizing the adapters to look
identical and picking among them with one generic score. That's also why
this contract stays deliberately thin per-provider: "same interface" is a
dispatch-mechanics abstraction, not a claim that the providers are
interchangeable.

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
  resolutionCriteria?: string;  // optional; see §12 — source mechanism still open
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
  thread_ts           TEXT PRIMARY KEY,
  channel_id          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_criteria TEXT,                          -- Phase 3-reserved: nullable, unused by
                                                       -- Phase 2 logic; see §12 for the target design
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
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
  current intent — **not** from Slack's `conversations.replies`.
- **History depth `N` is configurable, with a per-request override
  (resolved, [§18.9](#18-open-design-decisions)):**
  - A config default (`CONTEXT_HISTORY_DEPTH`, validated by the Zod env
    schema per [§5](#5-project-conventions)) sets `N` when nothing else
    overrides it. This is expected to be tuned experimentally, not a fixed
    constant baked into code.
  - An **explicit** per-dispatch override via `--history=<n>` in the
    command grammar (§6) takes precedence over the config default.
  - An **implicit** override may come from the task/control verb itself —
    e.g. `file-issue` naturally wants the full thread rather than a
    windowed `N`, while a quick one-off question wants very little. Phase
    2 does not attempt to formalize a rule table for every task type; it
    keeps the mechanism (the dispatcher is free to pass a different
    `limit` into `getRecentEntries` per code path) available without
    requiring every task type's implicit value to be pinned down now.
  - **Scope note:** context here is genuinely more than a single number
    once threads carry file attachments, multiple agents' outputs, etc. —
    that fuller "assemble the whole context window" problem is explicitly
    Phase 3's job. Phase 2 keeps `context_entries` to simple, compacted
    text summaries and a single depth parameter; it does not attempt file
    handling or multi-dimensional context assembly yet.
- **Write path:** after a successful adapter call, the dispatcher writes
  one `context_entries` row (`agent: <the adapter name>`, `summary:` a
  compacted version of the reply — not the raw text verbatim if it's long)
  and updates `threads.updated_at`.
- **Compaction:** Phase 2 keeps compaction simple — truncate/summarize
  server-side to a fixed max length before writing the entry, rather than
  storing full transcripts. A dedicated summarization pass is a Phase 4
  concern (memory formalization); Phase 2 just needs "don't grow
  unbounded."

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
- Phase 2 ships a minimal registry — **confirmed starter skill (resolved,
  [§18.5](#18-open-design-decisions)): `terse`**, constraining reply
  length/verbosity — the point of this phase is that the seam exists and
  is exercised by at least one real skill, not that the skill library is
  complete.
- **`issue-title` — a second skill, internal-only (resolved,
  [§18.4](#18-open-design-decisions)):** unlike `terse`, this is not
  user-invocable via `--skill=` — it's called internally by the GitHub
  Issue Bridge (§11) when `file-issue` is run without an explicit
  `--title=`. It reuses the exact same `Skill` shape (a system-prompt
  fragment) and the same `Adapter.invoke()` call used everywhere else — no
  new type is needed. The bridge assembles the thread's context entries
  into a message, applies this skill's system-prompt fragment (instructing
  a concise, issue-appropriate title), and does a one-off adapter call to
  synthesize the title text. This matters specifically because a request
  to file an issue may come from anywhere in a thread's history and won't
  always have an explicit title stated by whoever submitted it.
- **Proving the skill actually does something:** the seam isn't validated
  just because `--skill=terse` is accepted without erroring — it needs to
  visibly change adapter behavior. The test is dispatching the *same*
  intent to the *same* adapter twice, once with `--skill=terse` and once
  without, and comparing the two replies (length, tone). The dispatch log
  and prompt/response archive in [§14](#14-logging--the-dispatch-log)
  exist partly to make that comparison easy to pull up rather than
  eyeballing raw Slack scrollback.

## 10. Dispatch Flow

Step-by-step, for a single incoming Slack event:

1. **Receive** — Bolt event listener fires on `app_mention` events and DMs
   only ([§18.2](#18-open-design-decisions)) — unmentioned thread replies
   are not dispatched in Phase 2. Non-matching events are ignored before
   any parsing happens.
2. **Parse** — raw text → `ParsedCommand` (§6). Malformed input short-circuits
   here: reply with the validation error, stop (no logging, no context write).
3. **Control-verb branch** — if the command is `file-issue` or `help`,
   hand off to that command's handler (§11) and stop; this bypasses the
   adapter/skills/context path entirely.
4. **Load context** — `contextStore.getThread(threadTs)`; create the
   thread record if absent. `contextStore.getRecentEntries(threadTs, N)`,
   where `N` comes from the request's `--history` override if present, else
   the configured default (§8).
5. **Resolve skills** — look up each requested skill name in the registry
   (already validated to exist at parse time); fold them over the base
   system prompt in order.
6. **Assemble messages** — compacted history entries + current intent become
   the `AdapterMessage[]` per the adapter contract (§7).
7. **Resolve adapter** — look up `--agent` in the adapter registry (already
   validated to exist at parse time).
8. **Invoke** — `adapter.invoke(request)`. See [§15](#15-error-handling--failure-modes)
   for timeout/failure handling and retry policy.
9. **Log the dispatch decision** — one `dispatch_log` row
   (`intent, skills_applied, agent_chosen`, `reasoning: null`) plus a
   structured Pino `info` log line, written **regardless of adapter
   success or failure** (failures log at `warn`/`error` with the failure
   reason instead of a reply summary — see §15's structured-error-logging
   requirement).
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
  body.
- **Title resolution (resolved, [§18.4](#18-open-design-decisions)),
  checked in order:**
  1. **`--title=<text>` explicit override** (§6) — used verbatim.
  2. **No override** — the bridge assembles the thread's `context_entries`
     into a message, applies the `issue-title` skill's system-prompt
     fragment (§9), and calls `adapters[ISSUE_TITLE_ADAPTER].invoke()` as a
     one-off request (not part of the normal dispatch flow, so it doesn't
     get its own `dispatch_log` row) to synthesize a concise title.
     `ISSUE_TITLE_ADAPTER` is a configured env var (Zod-validated against
     the adapter registry, §5) rather than hardcoding which adapter does
     this — Claude is the expected default given its fit for this kind of
     short generative task (§7's routing philosophy), but it's not wired in
     as a constant.
  This is a separate question from *marking a thread closed*, which does
  not involve a title at all — see [§12](#12-thread-closure--resolution-signal).
- **Repo resolution (resolved, [§18.3](#18-open-design-decisions)):** the
  `[repo]` argument is resolved in this order, prioritizing "seamlessly
  easy for the common case" while keeping an explicit escape hatch:
  1. **Contains a `/`** (e.g. `someorg/somerepo`) — used verbatim. This is
     the escape hatch for filing outside avoidTheLite entirely.
  2. **Bare name, no `/`** (e.g. `dotfiles`) — prefixed with `avoidTheLite/`
     (→ `avoidTheLite/dotfiles`). This is the default path and needs no
     extra flag for the common case of filing into one of your own repos.
  3. **Omitted entirely** — defaults to **avoidTheLite/dkr** (the domain
     knowledge repository). For Phase 2 MVP this is a **generic, un-triaged
     placement**: the bridge does not attempt to infer whether the content
     belongs under `/knowledge/_shared` or a specific
     `/knowledge/{product-or-subdomain}` folder — that classification is a
     manual (or later-phase) step. The issue body includes a short note
     pointing whoever triages it at that folder convention. (As of this
     writing avoidTheLite/dkr has no content yet — this is forward context
     for when it does.)
- **Action:** creates a GitHub Issue via the GitHub API (Octokit) in the
  resolved repo, applies a fixed label (e.g. `from-runner`) so filed issues
  are identifiable, and posts the issue URL back into the Slack thread.
- **Closure semantics:** per the thread-resolution design, marks the
  thread `resolved` (`contextStore.markResolved`) as the side effect of a
  real closure action — not a bare label applied for its own sake. In
  Phase 2 this is the **only** path to `resolved`; the checkmark
  confirmation flow described in [§12](#12-thread-closure--resolution-signal)
  is Phase 3 forward context, not a second path that exists yet.
- **Scope boundary:** this is the *only* closure action Phase 2 implements.
  `capture`, `promote`, and `dispatch` from the intake design are out of
  scope here (§2) — they belong to that broader design's own workstream.

## 12. Thread Closure & Resolution Signal

**Phase 2 scope (resolved, [§18.11](#18-open-design-decisions)):** this
section's original checkmark-confirmation flow is **not implemented in
Phase 2**. Building it now would mean guessing at UX for a policy
(closure rules — what actually counts as "done" for a thread) that hasn't
been defined yet; that policy is Phase 3's job. The design is kept below,
clearly labeled, as forward context so Phase 3 doesn't start from a blank
page.

**Phase 2 baseline behavior (the "rudimentary assumption"):** every thread
the runner is dispatched into is treated as something it is actively
working to resolve, not a one-off Q&A. This is a design stance, not a new
mechanism — it doesn't add any schema, listener, or message format beyond
what's already specified:

- **Capturing the requisite information** happens through the existing
  context store (§8) — every dispatch's compacted result is written back
  as a `context_entries` row, so the thread accumulates toward an answer
  rather than each message standing alone.
- **Dispatching agents to complete tasks** happens through the existing
  dispatch flow (§10) and, for coding work, the Cursor/Copilot adapters
  (§7) and their async completion follow-up (§13).
- **Filing a GitHub issue** (§11) remains the one explicit, human-invoked
  action that formally marks a thread `resolved` in Phase 2 — there is no
  automatic or implicit resolution beyond that.
- Nothing here requires the runner to track "how close is this thread to
  done" in Phase 2; it simply keeps processing toward the request each
  time it's addressed. Phase 3 is where that gets made explicit (below).

**Phase 3 target design (not built yet — kept as forward context):** once
closure rules exist, the plan is still the one worked out here. An earlier
assumption was that closing a thread meant updating some kind of title —
that was based on a misunderstanding of what Slack actually supports
(threads have no editable title). The real mechanism is simpler and uses a
built-in Slack primitive: **the human confirms closure by reacting to a
message with the native checkmark emoji**, the same way any other message
in this workspace gets marked done. The runner's job is to prompt for that
confirmation with a clear, structured message — not to invent its own
closure marker.

- **Human-facing closure action:** a ✅ (`white_check_mark`, or whichever
  checkmark emoji the workspace convention uses) reaction added to a
  message the runner posted in the thread. This is a native Slack action;
  the runner does not require any special UI beyond what Slack already
  provides.
- **Runner-facing recommendation message:** when the runner judges a
  thread is ready to close, it **appends a new message** to the thread
  (never edits a prior message, never touches a "title") with this exact
  structure:
  1. First line, verbatim: `Thread complete - resolve thread?`
  2. A short summary of what the thread is trying to accomplish.
  3. A resolution-criteria checklist — what's done, what's left — if
     criteria were ever stated for the thread; if none were stated, a
     plain progress summary instead of a fabricated checklist.
- **Confirmation loop:** the runner subscribes to Slack `reaction_added`
  events. When the added reaction is a checkmark **and** the target message
  is one the runner itself posted in a thread it's tracking, it calls
  `contextStore.markResolved(threadTs)` — the same call already used by
  the GitHub issue bridge (§11) — so both paths converge on one piece of
  state (`threads.status = 'resolved'`) rather than each inventing its own
  notion of "done."
- **Relationship to the GitHub issue bridge:** confirming closure this way
  and filing an issue (§11) are independent actions. A checkmark
  confirmation does **not** automatically trigger `file-issue` — that
  remains an explicit, separate control verb. Whether closure should
  auto-file is itself a Phase 3+ question.
- **Trigger heuristic and resolution-criteria mechanism — the two open
  questions Phase 3 needs to settle:** exactly *when* the runner decides a
  thread looks done enough to post the recommendation (after every
  dispatch? on an explicit request like `@runner status`? a heuristic read
  off the adapter's own reply?), and how/whether a thread's resolution
  criteria get stated up front. Phase 3 is also expected to add a
  **validation process, or the runner asking the user directly for missing
  information**, as part of actually moving a thread toward closure —
  not just detecting that it's already done.

## 13. Async Completion Follow-up

**Resolved ([§18.7](#18-open-design-decisions)):** Cursor and Copilot
dispatches are asynchronous — `invoke()` only returns an acknowledgment
(§7). The architecture deliberately avoids a public HTTP endpoint (Socket
Mode specifically so none is needed, §5), so an inbound webhook receiver
would cut against that decision. The simplest approach consistent with it
— and standard practice for a Slack bot surfacing long-running external
work — is **polling from inside the runner process**, not an inbound
webhook.

**Adapter contract additions (§7):**

```ts
export interface AdapterResponse {
  text: string;
  raw: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  asyncTaskId?: string;   // present only for async-capable adapters (Cursor, Copilot)
}

export interface AsyncTaskStatus {
  state: 'pending' | 'completed' | 'failed';
  resultText?: string;    // e.g. a PR link/summary; present once state !== 'pending'
}

export interface Adapter {
  readonly name: string;
  invoke(request: AdapterRequest): Promise<AdapterResponse>;
  checkStatus?(externalTaskId: string): Promise<AsyncTaskStatus>;  // only implemented by async adapters
}
```

**Persistence:**

```sql
CREATE TABLE pending_async_tasks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_id       INTEGER NOT NULL REFERENCES dispatch_log(id),
  adapter           TEXT NOT NULL,
  external_task_id  TEXT NOT NULL,
  channel_id        TEXT NOT NULL,
  thread_ts         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at   TEXT
);
```

**Flow:**

1. When the dispatcher's `adapter.invoke(request)` (§10 step 8) returns an
   `asyncTaskId`, it posts the acknowledgment reply as normal (§10 step 10)
   and inserts one `pending_async_tasks` row — instead of writing a final
   `context_entries` summary immediately, since there's no result yet.
2. A single in-process poller (`setInterval`, cadence configurable via
   `ASYNC_POLL_INTERVAL_MS`, default 60000) runs on a fixed tick: selects
   every `status = 'pending'` row, and for each calls
   `adapters[adapter].checkStatus(externalTaskId)`:
   - **`completed` or `failed`** → posts a **new threaded reply** into the
     original `thread_ts` (a new message, not an edit — it keeps the
     acknowledgment visible as its own timeline entry and avoids edit-race
     conditions), prefixed the same way as a normal reply (e.g.
     `*[cursor]*`), containing `resultText`; writes a compacted
     `context_entries` row so later follow-ups in the thread see the
     result the same way they would any other dispatch (§8); updates the
     row's `status`.
   - **still `pending`** → updates `last_checked_at` only, no reply.
3. **Timeout:** a row still `pending` after `ASYNC_TASK_TIMEOUT_MS`
   (configurable, default 24h) is marked `failed` and gets a reply noting
   the task appears stalled, including the original tracking link so it
   can be checked manually.
4. **Restart-safe by construction:** pending tasks live in SQLite, not
   in-memory, so a runner process restart just resumes polling on the next
   tick — no separate durable queue or job system needed at Phase 2 scale.
5. **Trade-off, stated plainly:** completion is noticed with up to
   `ASYNC_POLL_INTERVAL_MS` of latency rather than instantly. That's an
   acceptable Phase 2 cost for not standing up a public-facing webhook
   receiver.

## 14. Logging & the Dispatch Log

- Every dispatch (successful or failed) produces:
  - a structured Pino JSON log line (fields: `threadTs`, `intent`,
    `skillsApplied`, `agentChosen`, `outcome`, `attempt`), and
  - a `dispatch_log` row (§8), which is what makes "log every dispatch
    decision" queryable rather than just grep-able in log files.
- The `reasoning` column exists now, nullable, specifically so Phase 3's
  auto-routing work extends this table rather than migrating it.
- Log levels follow the standard table in §5 — dispatch success is `info`,
  a parser rejection is `warn` (expected/operational), an adapter failure
  is `error` if unexpected or `warn` if it's a known/operational condition
  (e.g. rate limit — see §15).
- **Every failure log line and every in-thread error reply share the same
  underlying error fields** (see §15's diagnosability policy) — the Pino
  log is not a superset of information the Slack reply lacks; it's a
  machine-queryable copy of the same facts.

**Prompt/output comparison & routing analytics (new, addresses "we haven't
talked about comparing outputs"):** the `dispatch_log` row above is
intentionally compact (names and outcomes, not full text) — comparing
actual adapter behavior (e.g. does `--skill=terse` really shorten Claude's
replies? does Cursor answer a given intent noticeably differently from
Copilot?) needs the full prompt and response text, which doesn't belong in
that table or in routine Pino output at `info` level.

```sql
CREATE TABLE dispatch_artifacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_id   INTEGER NOT NULL REFERENCES dispatch_log(id),
  prompt_json   TEXT NOT NULL,   -- full AdapterRequest.messages, as JSON
  response_text TEXT NOT NULL,   -- full AdapterResponse.text
  usage_json    TEXT,             -- AdapterResponse.usage, as JSON, nullable
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- The dispatcher writes one `dispatch_artifacts` row per dispatch, keyed to
  its `dispatch_log` row, holding the full assembled prompt and full raw
  reply — the data a human (or a future agent) needs to actually diff two
  dispatches, not just see that they happened.
- **Purpose:** build a real evidence base — same or similar intents across
  different adapters/skills — that Phase 3's auto-routing decision engine
  can be trained/tuned against, instead of routing on guesswork. This is
  also the mechanism that proves the skills seam works (§9).
- **Phase 2 scope:** persistence only. Querying `dispatch_log` joined with
  `dispatch_artifacts` (SQL, or `jq` over exported Pino logs) is enough to
  do this comparison by hand for now. **No dedicated dashboard/UI is built
  in Phase 2** — the exact shape of a future comparison surface (a static
  HTML report, a small Express view, a CLI script) is intentionally left
  open rather than picked now; see
  [§18.13](#18-open-design-decisions).

## 15. Error Handling & Failure Modes

**Governing policy (resolved, [§18.10](#18-open-design-decisions)):** this
service assumes the Slack thread itself is the primary way a failure gets
noticed and diagnosed — not a log dashboard someone happens to be watching.
Every in-thread error reply must therefore contain enough for a human *or
an agent reading only that message* to understand what failed and start
diagnosing it: which stage failed (parse/adapter/context-store/Slack),
which adapter and skills were involved, the attempt count, and a sanitized
version of the underlying error (never a raw secret or stack trace, but
never just "something went wrong" either). This is stricter than a typical
generic-500-style message, by design.

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

Every thrown error carries enough structured detail (`threadTs`,
`agentChosen`, `skillsApplied`, `attempt`, a `cause`) for both the Slack
reply text and the paired Pino log line to be built from the *same*
object — there is one source of truth for "what happened," rendered twice
(human-readable in Slack, structured in the log).

**Retry policy (resolved, [§18.10](#18-open-design-decisions)):**

- Assuming the runner process itself is healthy, an adapter timeout or 5xx
  gets **exactly one retry against the same adapter** before it's treated
  as a failure. There is **no cross-adapter fallback in Phase 2** (e.g.
  falling back from Claude to a local model, or to a different adapter
  entirely) — since `--agent` is always an explicit, required input in
  this phase (§1), there is never an "adapter wasn't specified" case to
  fall back from. That fallback concept only becomes meaningful once
  Phase 3 introduces default/auto-selected adapters (see
  [§2](#2-out-of-scope)); Phase 2's retry logic is deliberately this
  simple.

| Failure | Handling |
|---|---|
| Malformed command / unknown `--agent` / unknown `--skill` / bad `--history` | `ValidationError` → reply in-thread with the specific reason (including which registered names *are* valid, so the caller doesn't have to guess-and-check), no dispatch-log row, no context write (§6). |
| Adapter timeout or 5xx | One retry against the **same** adapter (no backoff delay needed for a single retry at this volume — a fixed short delay, e.g. 1s, is sufficient). If the retry also fails: `AdapterError` → in-thread reply naming the adapter, the intent, and that both attempts failed, plus the sanitized upstream error; dispatch-log row written with `outcome: "adapter_error"` so the failure itself is queryable. |
| Adapter rate limit (429) | Treated as operational (`warn`, not `error`); same one-retry/reply/logging path as above, distinct `outcome: "adapter_rate_limited"` value so Phase 3's budget-polling work can query specifically for these. |
| Context store unavailable at read time | `ContextStoreError` → fail closed: reply naming the failure stage ("context store unavailable") rather than silently dispatching with no history. |
| Context store unavailable at write time (post-dispatch) | Reply still goes out (the user gets their answer); write failure is logged at `error` with full structured detail but does not re-surface to Slack — a lost compaction write is recoverable, a lost reply is not. |
| Slack API failure posting the reply | Logged at `error` with full structured detail; no further retry loop in Phase 2 (avoids duplicate replies) — flagged as acceptable manual-recovery behavior for this phase. |

## 16. Security & Secrets

- **Slack:** `SLACK_APP_TOKEN` (Socket Mode) and `SLACK_BOT_TOKEN`,
  provisioned with least-privilege scopes — `app_mentions:read`,
  `chat:write`, and `channels:history`/`groups:history` only if thread
  history is ever read directly from Slack (it currently isn't; the
  runner reads its own context store — see §8). `reactions:read` is
  **reserved for Phase 3** (the checkmark-confirmation listener in §12) —
  not requested in Phase 2, since nothing consumes it yet.
- **Adapters:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — provider keys only,
  never bundled with any other secret in the same variable.
- **GitHub:** a token scoped to `repo`/`issues:write` for the target
  repo(s) the issue bridge is allowed to file into.
- **Runner config:** `ISSUE_TITLE_ADAPTER` (which registered adapter
  synthesizes issue titles when `--title=` is omitted, §11 — Zod-validated
  against the adapter registry, not a free string), `ASYNC_POLL_INTERVAL_MS`
  (default `60000`) and `ASYNC_TASK_TIMEOUT_MS` (default `86400000`, i.e.
  24h) for the async-completion poller (§13).
- **All secrets** loaded via `.env` locally (gitignored) and validated by
  the Zod env schema at boot (§5) — the app fails fast rather than running
  with an unset/malformed secret. No real secrets ever committed; fake
  values only (`sk-test-...`, `REDACTED`) in examples/docs. Gitleaks
  enforced in CI per the standards file.
- **Env segregation:** dev/test/prod use distinct env files/secret stores;
  never shared across environments.

## 17. Testing Strategy

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

## 18. Open Design Decisions

Per this workspace's convergence discipline (don't invent, don't leave a
fork silently resolved) — items below are resolved per your feedback, with
the still-open ones called out explicitly rather than guessed.

1. **Command syntax fork — Resolved.** Flag-canonical + colon-shorthand
   alias (§6), confirmed.
2. **Trigger surface & DMs — Resolved.** `@runner` responds only to direct
   `@`-mentions and to DMs in Phase 2 — not to unmentioned replies within a
   thread it has already participated in. A concise opt-in (e.g. a `--watch`
   flag or equivalent) that would let it keep responding in a thread
   without re-mention is deferred to **Phase 3** (§2).
3. **GitHub issue bridge: repo resolution — Resolved.** Bare repo name →
   `avoidTheLite/<name>` prefix by default (simplest path for the common
   case); an `owner/repo` argument (contains `/`) is the escape hatch to
   file anywhere else; omitted entirely → defaults to avoidTheLite/dkr,
   filed generically/un-triaged since that repo has no
   `/knowledge/_shared` vs `/knowledge/{product-or-subdomain}` structure
   populated yet to classify against (§11).
4. **GitHub issue bridge: title heuristic — Resolved.** Repo resolution is
   settled (#3 above) and is a separate question from *marking a thread
   closed*, which no longer involves a title at all (§12). Title
   resolution order (§11): an explicit `--title=<text>` override (§6) wins
   if present; otherwise a new internal-only **`issue-title` skill** (§9)
   assembles the thread's context and calls a configured adapter
   (`ISSUE_TITLE_ADAPTER`, §16) to synthesize a concise title — since a
   file-issue request may not have an explicit title stated by whoever
   submitted it.
5. **Starter skill set — Resolved.** Confirmed: `terse` (constrains reply
   length/verbosity) is the user-invocable starter skill, good for
   exercising the seam; `issue-title` (#4 above) is a second, internal-only
   skill added for the GitHub issue bridge. The test that `terse` is
   actually doing something: dispatch the same intent to the same adapter
   with and without `--skill=terse` and compare the two replies — the
   `dispatch_artifacts` table (§14) exists partly to make that comparison
   easy.
6. **Cursor/Copilot posture — Resolved.** Both are first-class Phase 2
   adapters (§7), called directly rather than only via their native Slack
   apps, since they're callable directly today.
7. **Cursor/Copilot async completion callback — Resolved.** Cursor/Copilot
   dispatches are asynchronous — `invoke()` returns an acknowledgment plus
   an `asyncTaskId`, not a finished answer (§7). A public webhook receiver
   would cut against the Socket-Mode-only deployment stance (#8 below), so
   the eventual PR/result is surfaced via **in-process polling**: a single
   `setInterval` loop checks a new `pending_async_tasks` table (persisted
   in SQLite, restart-safe) and posts a new threaded reply once an
   adapter's `checkStatus()` reports completion or failure, or once a
   configurable timeout elapses. Full design in §13.
8. **Deployment shape — Resolved.** Single Docker image, run standalone
   (`docker run`) for Phase 2 — matching the low-ceremony approach planned
   for the Phase 3 local-model stack (starting from the stock OpenWebUI
   image before anything is composed). A self-authored
   `docker-compose.yml` uniting runner + local-model stack is anticipated
   once Phase 3 lands, not a Phase 2 requirement (§5).
9. **History depth (`N`) — Resolved.** Configurable via a
   `CONTEXT_HISTORY_DEPTH` env default, overridable per-dispatch via
   `--history=<n>` (explicit) or by the task/control verb itself
   (implicit, e.g. `file-issue` wanting the full thread) — mechanism
   documented in §8, not a hardcoded constant. Full context-window
   assembly across threads/files is explicitly deferred to Phase 3;
   Phase 2 keeps `context_entries` to simple compacted text.
10. **Retry/backoff & error verbosity — Resolved.** Governing policy: the
    Slack thread is the primary diagnostic surface, so error replies must
    be verbose enough for a human or agent to diagnose the failure from
    the message alone, paired with matching structured Pino logs (§14,
    §15). Retry policy: one retry against the **same** adapter if the
    runner itself is healthy; **no cross-adapter fallback in Phase 2**
    since `--agent` is always required as explicit input this phase —
    that fallback concept (e.g. trying a local model or a different agent
    if the named one is unresponsive) only becomes meaningful once Phase 3
    introduces default/auto-selected adapters (§2, §15).
11. **Thread closure trigger heuristic & resolution-criteria mechanism —
    Resolved (deferred to Phase 3; Phase 2 baseline defined).** Building the
    checkmark-confirmation flow now would mean guessing at closure rules
    that don't exist yet, so it's **not implemented in Phase 2** — kept in
    §12 as forward context for Phase 3, along with the still-unsettled
    trigger heuristic and resolution-criteria mechanism themselves, which
    Phase 3 will need to settle before that flow can ship. Phase 2's
    baseline instead: the runner treats every thread it's dispatched into
    as something actively being worked toward resolution via the existing
    context-store/dispatch-flow mechanics (§12) — no new schema, listener,
    or UX. Phase 3 is also expected to add a validation process, or have
    the runner ask the user directly for missing information, as part of
    actually moving a thread toward closure.
12. **Adapter routing philosophy — Resolved (captured for Phase 3).** Your
    current manual mental model — Cursor/Copilot for well-defined coding
    tasks, Claude for conversational/spec work, OpenAI still
    experimental — is documented in §7 as a starting heuristic for Phase
    3's decision engine. Not enforced in Phase 2 code; `--agent` stays a
    required explicit input (§1).
13. **Prompt/output comparison tooling shape — Still open (new).** The
    data model for comparing adapter/skill behavior is defined (the
    `dispatch_artifacts` table, §14), but the presentation layer isn't —
    static report, small Express view, CLI script, or something else —
    flagging for your input once there's enough data to make that concrete.

## 19. Traceability to Phase 2 Exit Criteria

| Plan requirement | Where covered |
|---|---|
| Own Slack identity, Bolt + Socket Mode, no public URL | §4, §5 |
| CLI-style syntax `@runner [intent] --skill=x,y --agent=z` | §6 |
| Claude API adapter (stateless, full `messages` array per call) | §7 |
| OpenAI API adapter | §7 |
| Cursor/Copilot: routing posture decided | §7, §18.6 — resolved as first-class Phase 2 adapters called directly, not native-app-only |
| Context store (SQLite/Postgres), keyed by `thread_ts`/task id | §8 |
| Parse intent+flags → context slice → assemble system prompt (skills as middleware) → call adapter → post reply → write back compacted summary | §9, §10 |
| Spec-to-GitHub-issue bridge | §11 |
| Log every dispatch decision (intent, skills, agent chosen) | §14 |
| `@runner claude: draft a spec for X` and `@runner cursor: fix the auth bug` both work from the same thread; follow-ups pull prior context from the runner's own store | §6 (shorthand — `cursor:` now dispatches to a real adapter, §7), §8 |
| Thread closure signal (checkmark confirmation + recommendation message) | §12 (Phase 3 target design; Phase 2 baseline documented alongside it) |
| Prompt/output comparison data for future routing analytics | §14 |

---

_This document is a draft for iteration. Item #13 in §18 (prompt/output
comparison tooling shape) is still open — everything else has been
resolved per your feedback. Once that's settled, this file is the handoff
artifact for the implementing agent — no further scope should need
inventing at implementation time._
