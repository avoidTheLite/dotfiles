# Generation dev loops

Three process flows share one generator. They do not share runtime, Docker, or an LLM.

This document is the contract. Implementation lands in follow-up PRs. The operator ports file is **not** in this repository yet; loaders must use [examples/ports.defaults.json](examples/ports.defaults.json) until that file exists.

## Shared kernel vs split

```text
                    ┌─────────────────────────────────────┐
                    │ Shared kernel                       │
                    │  - dotfiles install / generate      │
                    │  - scaffold-config.schema.json      │
                    │  - scenario fixtures + goldens      │
                    │  - inspect/compare (pure function)  │
                    │  - ports schema + defaults          │
                    │  - Pino createLogger({ module })    │
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
| Ports schema + 5173/3000 defaults | yes | only homelab (and later `pnpm dev`) bind ports; CI does not |
| Operator ports file | schema now; file later | homelab script imports it; gitignore if it holds LAN hostnames |
| Pino wrapper | yes (`module`, `runId`, `scenarioId`) | JSON in CI; `pino-pretty` on a TTY |
| Prompt files (skill + portable prompt) | format only | **agent loop only** |
| Prompt cache (`.dotfiles-cache/`) | format only | **agent loop only**; never CI; gitignored |
| Docker images of web and/or api | Dockerfiles from templates later | **homelab only** (optional extra CI job later) |
| GitHub Actions | `node --test` goldens | not the agent; not the home server |

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
5. GitHub Actions already runs `node --test scripts/generate.test.mjs`; goldens extend that file. No new workflow unless a slower optional job (image build) is added later.

**Does not:** call an LLM, start servers, publish ports, or build Docker images.

Today’s tests check existence of a few paths. Goldens replace that with a full tree so template edits cannot silently drop a file.

## Flow 2 — Agent generate → inspect → fix

**Goal:** an agent command follows the skill, generates, inspects with the same function as CI, then patches templates or config until inspect is clean.

```text
skill + scenario → generate → inspect → (drift? patch + re-run : stop)
                 ↘ Pino JSON log
                 ↘ prompt cache record
```

1. **Prompt adapter** loads `agent-skills/skills/scaffold-monorepo/SKILL.md` (and a new `generate-inspect-fix` skill when it exists), plus the scenario JSON. Portable copy stays under `agent-skills/prompts/` per existing skill layout.
2. **Prompt cache / save** writes `.dotfiles-cache/prompts/<sha256>.json` where the key is `sha256(prompt bytes + git SHA of this repo + canonical scenario JSON)`. Hits replay the saved generate/inspect result. Misses run generate and store `{ prompt, inputs, outputManifest, logFile }`. Directory is gitignored (see [PRIVACY](../../guides/validation/PRIVACY.md)).
3. **Pino adapter** wraps the CLI/harness. No `console.log` in new harness code. Child logger fields: `module` (`cli` / `inspect` / `prompt-cache`), `runId`, `scenarioId`, `cacheHit`. Local TTY may pipe through `pino-pretty`; CI stays raw JSON.
4. Inspect uses the **same** compare as Flow 1. Drift is a structured log event plus a file list, not a prose dump.
5. On drift, the agent edits templates or the scenario, then re-runs. It does not hand-write `apps/` or invent a parallel turbo/plop setup.

**Does not:** publish ports, SSH to the home server, or skip inspect because the cache had a previous success with different template bytes (cache key includes git SHA).

## Flow 3 — Homelab Docker + port forward

**Goal:** take **that** generated web and/or api, image it, and run it on a home server reachable on the LAN. Port mapping comes from config, not hardcoded compose.

```text
generate (or use an existing target)
  → docker build web and/or api
  → read ports file | defaults
  → publish hostPort:containerPort
```

1. Build images from the generated tree (client, service, or both). Tag with the **dotfiles git SHA** plus the scenario id so “that version” is reproducible.
2. A small compose file or `scripts/` runner on the home server starts the containers. Host and container ports are imported from the operator ports file; if the file is missing, use [examples/ports.defaults.json](examples/ports.defaults.json) (`web=5173`, `api=3000`).
3. Vite’s `/api` proxy target and the API `PORT` must follow the same config so the browser on the LAN hits the api container, not a stale 3000.
4. v1 LAN access is **published ports** on the home server (firewall + bind address). No extra tunnel product in this repo. Compose `ports:` is the forward.

**Does not:** change golden files, call the prompt cache, or require GitHub-hosted runners to reach the LAN.

## Ports contract

Schema: [ports.schema.json](ports.schema.json)

Loader order (when code exists):

1. Path from `DOTFILES_PORTS_FILE` if set.
2. Operator file they will add (path decided when that file lands; likely `config/ports.json` or a gitignored homelab path).
3. [examples/ports.defaults.json](examples/ports.defaults.json).

Do not bake 5173/3000 into Docker or the forward script except as those defaults. Templates today hardcode the ports; wiring templates to this schema is a follow-up, not this plan PR.

## What stays out of git

| Path | Why |
| --- | --- |
| `.dotfiles-cache/` | prompt replay; may include user scenario text |
| `private/` | already gitignored |
| operator ports file if it names real LAN hosts | privacy guide; defaults example is public |

## Follow-up implementation order

1. Golden manifests + `inspect` helper used by `scripts/generate.test.mjs`.
2. Pino wrapper on the CLI/harness; prompt adapter + cache; `generate-inspect-fix` skill.
3. Dockerfiles in scaffolding templates; homelab run script that imports the ports file.
4. Operator adds the real ports file; loader keeps the defaults fallback.
