# Validation — security patterns (placeholder)

> **Scope:** A place to document **future** automated checks for vulnerability patterns, unsafe shell usage,
> and **prompt-injection** or LLM-prompt safety when your specifications or runbooks are stored next to
> code. Nothing in this file is required by CI **yet**; the workflow may add a no-op or opt-in job later.

## Intent

- **Dependency and image scanning** belong in each application and container pipeline (for example OSV,
  Trivy, Dependabot, or an internal mirror). This repository may later reference those standards without
  re-implementing them.
- **Prompt-injection** resistance is a product and prompt-design concern first. When you add machine checks,
  prefer **linting of known bad patterns in committed prompts** and **separation of system and user
  content** in documented templates, not a single “AI firewall” in dotfiles.
- For **LLM or agent** Python stacks, the [AI Python](../ai/python/STYLE_GUIDE.md) guide will be the
  primary application-level home; this file will only point to shared validation hooks once they exist.

## Related

- [A11Y.md](A11Y.md) for user-facing UI validation
- [PRIVACY.md](PRIVACY.md) for secrets in documentation
