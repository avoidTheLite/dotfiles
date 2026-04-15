# Style Guide — Python (CLI)

> **Command-line tools** built in Python (default stack: **Typer** per monorepo
> Python guide). Add exit codes, subcommand layout, and packaging notes here as
> you standardize.

All **shared** Python rules (uv, Ruff, Pyright strict, Pydantic at boundaries,
pytest) live in **[Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md)**. Read
that guide first.

---

## Planned topics (expand as you standardize)

- Typer apps vs click compatibility; **Pydantic** for structured CLI payloads
- `--help` / UX consistency with other CLIs in the repo
- Distribution (`uv` scripts entry points, single-binary stories if any)

---

## Related guides

- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
