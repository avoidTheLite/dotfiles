# Style Guide — Python (AI / agents)

> **Agent workflows, LLM tool calling, and structured AI I/O** (e.g. CrewAI,
> LangGraph). This file will accumulate **domain-specific** conventions once you
> ship AI packages in the monorepo.

All **shared** Python rules (uv, Ruff, Pyright strict, Pydantic at boundaries,
pytest, OpenAPI where HTTP is involved) live in
**[Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md)**. Read that guide first.

---

## Planned topics (expand as you standardize)

- Graph and tool boundaries; **Pydantic** models for every agent/tool payload
- Testing agents (fixtures, fakes, evaluation harnesses)
- Observability and cost tracing (align field names with the rest of the stack)

---

## Related guides

- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
