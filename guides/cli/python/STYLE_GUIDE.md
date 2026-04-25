# Style Guide — Python (CLI)

> **Command-line tools** built in Python (default stack: **Typer** per
> [Python (platform)](../../platform/python/STYLE_GUIDE.md)). Add exit codes, subcommand layout, and
> packaging notes here as you standardize.

All **shared** Python rules (uv, Ruff, Pyright strict, Pydantic at boundaries,
pytest) live in **[Python (platform)](../../platform/python/STYLE_GUIDE.md)**. Read
that guide first. If the repo is **polyglot Turborepo**, also read
[Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md).

---

## Planned topics (expand as you standardize)

- Typer apps vs click compatibility; **Pydantic** for structured CLI payloads
- `--help` / UX consistency with other CLIs in the repo
- Distribution (`uv` scripts entry points, single-binary stories if any)

---

## Related guides

- [Python (platform)](../../platform/python/STYLE_GUIDE.md)
- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) (polyglot Turbo only)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
- [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) (polyglot only)
