# Actions Budget Mode

This private repository keeps GitHub Actions checks available without spending hosted-runner minutes on every push or pull request.

## Policy

- GitHub Actions workflows are manual by default with `workflow_dispatch`.
- Local verification and storefront build checks should run before spending a hosted runner.
- Cloudflare build/deploy logs are the practical deployment evidence when available outside GitHub Actions.
- Manual Actions runs are reserved for release candidates, exact-SHA proof, runner-health checks, or founder-requested verification.

## Merge authority

A passing manual workflow is evidence, not automatic approval. Founder/Control Room review still decides whether a branch can merge.

## Runner-startup classification

If a GitHub Actions job has zero steps or no logs, classify it as `runner_startup_failure`, not an application-code failure.
