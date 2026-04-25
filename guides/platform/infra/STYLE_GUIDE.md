# Style guide — infrastructure as code (Terraform and OpenTofu)

> **Scope:** Conventions for cloud and platform provisioning in this ecosystem. The **HashiCorp Terraform** and
> **OpenTofu** languages are the same HCL; the binary you run is a project choice. This guide is written so
> teams that standardize on either tool stay compatible at the file level.

## Choose a tool once per repository

- **OpenTofu** is a community fork with an open license and a Terraform-compatible language; it is a good
  default for personal or OSS repositories when you do not need vendor-specific support contracts.
- **Terraform** (HashiCorp) is what many employers standardize on; keep the **same** `required_version` range
  and module layout you use at work if you need to move modules between the two.
- In CI, pin the **version** of whichever binary you use and fail the job when the lockfile or formatting
  drifts.

## Layout

- **Separate environments** with clear directory names, for example `environments/prod` and
  `environments/staging`, or use Terragrunt or workspaces only if the team’s runbook already describes it.
- **Modules** live under `modules/<name>` with a clear interface (variables and outputs) and a short
  `README` inside each module when it is not obvious.
- **State:** Use remote state with locking (for example S3 and DynamoDB, or a supported cloud backend). Never
  commit state files, and never check in `*.tfstate` or secrets.

## Review and static analysis

- Run **terraform fmt** or **tofu fmt** (same flags) in CI; reject unformatted HCL.
- Add **tflint** and either **Trivy** or **Checkov** (or both, if you can stand the signal-to-noise ratio) to
  catch misconfigurations before apply. Warnings that become noise should be baselined with an explicit
  comment in the runbook, not ignored silently.

## Secrets and providers

- **No secrets in HCL** except references to a vault, a managed secret, or a CI-injected var. For local
  development, use a `.tfvars` file that is gitignored and a documented example `terraform.tfvars.example`
  with fake values.
- **Provider pins:** Commit a **lock file** (`.terraform.lock.hcl` for Terraform; the same for OpenTofu in
  compatible workflows) so CI and humans resolve the same provider versions.

## Migration from Terraform at work

- Keep **module **`.tf`** files** portable: avoid provider block assumptions that only work in a single
  cloud’s wrapper. If you need employer-specific tags or naming, pass them in as variables with defaults
  documented in this guide’s consuming application spec.

## Related

- [Python (platform)](../../platform/python/STYLE_GUIDE.md) and [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md)
  for cross-language monorepos that call Terraform from package scripts, if you wire that way.
- [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md) and [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
  for root task runners that invoke fmt and validate.
