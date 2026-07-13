# Repository License Audit — 2026

**Repository:** `jussray/jussbeautifulhair-site`  
**Audit date:** 2026-07-13  
**Scope:** First-party licensing consistency, manifest metadata, third-party boundary, hosted-use fit, contact language, and investment-evaluation access.

## Files inspected

- `LICENSE`
- `README.md`
- `package.json`
- `package-lock.json`
- `THIRD_PARTY_NOTICES.md`
- `INVESTMENT_EVALUATION_NOTICE.md`
- `.github/workflows/quality-gate.yml`

## Search patterns used

Equivalent repository-wide GitHub code searches were performed for:

```text
"license": "MIT"
"license": "ISC"
"license": "Apache"
MIT License
Apache License
hello@jussbeautifulhair.com
Copyright ©
UNLICENSED
```

## Findings and disposition

1. The root `LICENSE` and README identify the first-party storefront as proprietary, copyright 2024–2026 Juss Ray.
2. Root `package.json` is `UNLICENSED`.
3. The committed root entry in `package-lock.json` incorrectly declared the first-party project as `MIT`. A one-time branch-only repair synchronized that root entry to `UNLICENSED`; the temporary workflow was removed afterward.
4. MIT, Apache, ISC, and other identifiers attached to resolved third-party packages remain intact and are not treated as stale first-party declarations.
5. `THIRD_PARTY_NOTICES.md` records the dependency boundary and release-time attribution requirement.
6. `INVESTMENT_EVALUATION_NOTICE.md` grants ordinary visitors narrow permission to use the owner-hosted storefront interface for browsing and purchasing without granting source-code or brand rights.
7. The README’s approved business contact channels remain product-specific. No unrelated repository is directed to the storefront email.
8. The repository’s existing typecheck, lint, test, and Sonar baseline is red independently of this legal/documentation work; that runtime quality issue remains separate from the license audit.

## Status

**Repository metadata and first-party licensing consistency: verified on this branch.**

A release-specific transitive attribution report must still be generated from the exact lockfile used for any externally distributed artifact.

This audit is an operational record, not legal advice.
