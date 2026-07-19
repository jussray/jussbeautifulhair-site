# Actions Budget Mode Report — 2026-07-19

## Decision

Move this private storefront repository away from automatic GitHub-hosted runner spend.

## Changed workflows

- `.github/workflows/quality-gate.yml`
- `.github/workflows/security-build.yml`
- `.github/workflows/deployment-boundary.yml`

Each workflow remains available through manual `workflow_dispatch`.

## Operating rule

Run local checks or deployment-platform checks first. Spend GitHub-hosted runner minutes only when a founder or Control Room decision asks for exact hosted evidence.

## Non-goals

- No workflow files were deleted.
- No deploy was run.
- No branch was merged.
