# Style Guide — Python (data / ETL)

> **Data processing and ETL** pipelines in Python. Default analytical engine:
> **Polars** when scale and typing matter (per monorepo Python guide).

All **shared** Python rules (uv, Ruff, Pyright strict, Pydantic at boundaries for
record handoffs, pytest, Hypothesis) live in
**[Python (platform)](../../platform/python/STYLE_GUIDE.md)**. Read that guide first. If the repo is
**polyglot Turborepo**, also read [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md).

---

## Planned topics (expand as you standardize)

- Lazy vs eager Polars; IO and schema evolution
- **Pydantic** models at pipeline boundaries (ingress/egress), not raw rows in
  between stages when crossing services
- Testing data jobs (fixtures, golden files, property tests)

---

## Related guides

- [Python (platform)](../../platform/python/STYLE_GUIDE.md)
- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) (polyglot Turbo only)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
- [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) (polyglot only)
