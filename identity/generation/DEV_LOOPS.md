# Generation dev loops

Three process flows share one generator. They do not share runtime, Docker, or an LLM.

Agents start at [AGENTS.md](../../AGENTS.md). Humans start at the root [README](../../README.md).

## Shared kernel vs split

```text
                    ┌─────────────────────────────────────┐
                    │ Shared kernel                       │
                    │  - dotfiles install / generate      │
                    │  - scaffold-config.schema.json      │
                    │  - scenario fixtures + goldens      │
                    │  - inspect/compare (pure function)  │
                    │  - config/ports.json + schema       │
                    │  - dotenv (.env.example / .env)     │
                    │  - Pino createLogger({ module })    │
                    │  - PromptCache get/set (key only)   │
                    └──────────────────┬──────────────────┘
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
    1. CI goldens              2. Agent inspect-fix         3. Homelab Docker
    GitHub Actions             agent command + cache        home server + LAN
```

| Concern | Shared | Split |
| --- | --- | --- |
| `installFromConfig` / `dotfiles install` | yes | no second generator |
| Scenario JSON (scaffold inputs) | yes | CI asserts; agent repairs; homelab runs |
| Golden path+hash manifest | yes (written by inspect) | CI fails the job; agent treats drift as a fix ticket |
| `config/ports.json` + schema defaults | yes; generator writes the file into each target | only homelab/`pnpm dev` bind ports; CI validates the file, does not listen |
| dotenv (`WEB_PORT`, `API_PORT`, `BIND`) | yes (override contract) | `.env` is local/homelab only; never CI secrets |
| Pino wrapper | yes (`module`, `runId`, `scenarioId`) | JSON in CI; `pino-pretty` on a TTY |
| Prompt files (skill + portable prompt) | format only | **agent loop only** |
| Prompt cache (`PromptCache.get/set`) | **keying contract** | filesystem v1; Redis or SQLite later; never CI |
| Docker images of web and/or api | Dockerfiles from templates later | **homelab only** (optional extra CI job later) |
| GitHub Actions | `node --test` goldens + ports file check | not the agent; not the home server |

**Tradeoff:** one inspect function keeps CI and the agent honest against the same bytes. Splitting Docker and prompt cache out of CI keeps generation tests deterministic, secret-free, and fast.

## Flow 1 — CI goldens (deterministic)

**Goal:** given a fixture JSON, the files created are exactly the committed golden.

```text
fixture JSON → installFromConfig(tempDir) → inspect(tree) → compare(golden)
```

1. Read a scenario from `identity/generation/examples/` (and later `identity/generation/scenarios/`).
2. Render into an empty temp directory through the existing CLI library. Do not shell out to a second implementation.
3. Build a stable manifest: relative paths, POSIX separators, content hashes. Skip `node_modules`, timestamps, and anything `dotfiles install` does not write (it does not run `pnpm install`).
4. Compare to a committed golden next to the fixture. Fail on add, delete, or hash drift.
5. GitHub Actions already runs `node --test scripts/generate.test.mjs`; goldens extend that file. Every PR also runs `scripts/validate/ports.mjs` so `config/ports.json` stays a valid structured object.

**Does not:** call an LLM, start servers, publish ports, or build Docker images.

Today’s tests check existence of a few paths (including generated `config/ports.json`). Goldens replace ad-hoc existence checks with a full tree so template edits cannot silently drop a file.

## Flow 2 — Agent generate → inspect → fix

**Goal:** an agent command follows the skill, generates, inspects with the same function as CI, then patches templates or config until inspect is clean.

```text
skill + scenario → generate → inspect → (drift? patch + re-run : stop)
                 ↘ Pino JSON log
                 ↘ prompt cache record
```

1. **Prompt adapter** loads `agent-skills/skills/scaffold-monorepo/SKILL.md` (and a new `generate-inspect-fix` skill when it exists), plus the scenario JSON. Portable copy stays under `agent-skills/prompts/` per existing skill layout.
2. **Prompt cache** is a `get(key)` / `set(key, record)` store. The key is `sha256(prompt bytes + git SHA of this repo + canonical scenario JSON)` and does **not** encode the backend. Filesystem v1 writes `.dotfiles-cache/prompts/<key>.json` (gitignored). Redis is `GET`/`SET` of the same key; SQLite is a `key PRIMARY KEY` table. Swap the store, keep the hasher. Hits replay `{ prompt, inputs, outputManifest, logFile }`.
3. **Pino adapter** wraps the CLI/harness. No `console.log` in new harness code. Child logger fields: `module` (`cli` / `inspect` / `prompt-cache`), `runId`, `scenarioId`, `cacheHit`. Local TTY may pipe through `pino-pretty`; CI stays raw JSON.
4. Inspect uses the **same** compare as Flow 1. Drift is a structured log event plus a file list, not a prose dump.
5. On drift, the agent edits templates or the scenario, then re-runs. It does not hand-write `apps/` or invent a parallel turbo/plop setup.

**Does not:** publish ports, SSH to the home server, or skip inspect because the cache had a previous success with different template bytes (cache key includes git SHA).

## Flow 3 — Homelab Docker + port forward

**Goal:** take **that** generated web and/or api, image it, and run it on a home server reachable on the LAN. Port mapping comes from the generated `config/ports.json`, overridden by dotenv.

```text
generate (or use an existing target)
  → docker build web and/or api
  → env (.env) then config/ports.json then schema defaults
  → publish bind:hostPort:containerPort
```

1. Build images from the generated tree (client, service, or both). Tag with the **dotfiles git SHA** plus the scenario id so “that version” is reproducible.
2. A small compose file or `scripts/` runner on the home server starts the containers. Ports come from dotenv (`WEB_PORT`, `API_PORT`, `BIND`) then `config/ports.json`. Schema defaults fill a missing key only; there is no second example JSON file.
3. Vite’s `/api` proxy target and the API listen port follow the same object. Host **bind** defaults to `127.0.0.1`. Homelab LAN sets `BIND=0.0.0.0` in `.env`. Inside a container the process still listens on `0.0.0.0`; `bind` is the host publish address.
4. v1 LAN access is **published ports** on the home server (firewall + bind). Compose `ports:` is the forward.

**Does not:** change golden files, call the prompt cache, or require GitHub-hosted runners to reach the LAN.

## Ports contract

- Schema: [ports.schema.json](ports.schema.json)
- This repo (CI-required): [config/ports.json](../../config/ports.json)
- dotenv: [.env.example](../../.env.example) committed; `.env` gitignored
- Generated repos receive the same `config/ports.json` + `.env.example` from `dotfiles install`

Loader order:

1. Environment (`WEB_PORT`, `API_PORT`, `BIND`), including values loaded from `.env`
2. `config/ports.json` in the repo being run (this tree or the generated app)
3. Schema property defaults (`web=5173`, `api=3000`, `bind=127.0.0.1`)

## Prompt cache backends

Keep the hasher and the record shape stable. The store is one module:

```text
get(key) -> record | null
set(key, record) -> void
```

| Backend | Mapping |
| --- | --- |
| Filesystem (v1) | `.dotfiles-cache/prompts/<key>.json` |
| Redis | `GET`/`SET` `dotfiles:prompt:<key>` |
| SQLite | `prompts(key TEXT PRIMARY KEY, record JSON, created_at)` |

## What stays out of git

| Path | Why |
| --- | --- |
| `.dotfiles-cache/` | prompt replay; may include user scenario text |
| `private/` | already gitignored |
| `.env` | local/homelab overrides; LAN bind or machine-specific values |

## Follow-up implementation order

1. Golden manifests + `inspect` helper used by `scripts/generate.test.mjs`.
2. Pino wrapper on the CLI/harness; `PromptCache` filesystem adapter (Redis/SQLite behind the same interface); `generate-inspect-fix` skill.
3. Dockerfiles in scaffolding templates; homelab run script that reads dotenv then `config/ports.json`.
