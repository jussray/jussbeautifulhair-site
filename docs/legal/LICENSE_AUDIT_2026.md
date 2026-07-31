# License and Ownership Metadata Audit

Date: July 31, 2026

## Purpose

This audit records repository metadata and ownership boundaries. It is not legal
advice, a securities document, an investment offer, a partnership agreement, a
confidentiality agreement, or a substitute for review by qualified counsel.

## Current-main finding

The first-party package metadata was inconsistent:

- `package.json` declared `UNLICENSED`;
- the root package entry in `package-lock.json` declared `MIT`;
- the package was not marked `private`;
- the root `LICENSE` mixed a first-party ownership notice with broad statements
  about third-party components and hosted use;
- no root third-party notice explained the dependency boundary.

The repository already contains the canonical public beauty-industry research
brief at `docs/industry-signals/beauty-under-the-radar-2026.md`. That research is
context, not evidence of inventory, sourcing, partnerships, customer demand, or
commercial performance.

## Decision

This focused replacement:

1. keeps the first-party package license identifier as `UNLICENSED`;
2. marks the package `private` to reduce accidental npm publication risk;
3. aligns the root lockfile package entry to `UNLICENSED` without changing any
   dependency version, archive, integrity value, or transitive license field;
4. narrows the root `LICENSE` to first-party expression and ordinary authorized
   hosted-storefront use;
5. adds `THIRD_PARTY_NOTICES.md` as an attribution and dependency-navigation
   boundary without claiming it is a complete transitive-license review;
6. adds an executable metadata verifier and immutable-head workflow.

## Why the stale PR was not copied

Stale PR #5 included custom investment-evaluation and due-diligence language.
That language could create ambiguity about rights, confidentiality, reliance,
or commercial intent and was not required to repair the objective package
metadata inconsistency.

This replacement therefore does not add:

- investor access rights;
- evaluation licenses;
- confidentiality promises;
- partnership or endorsement language;
- securities, fundraising, or diligence terms;
- a new contact address;
- dependency upgrades or regenerated integrity values.

## First-party boundary

The root `LICENSE` covers first-party source code, documentation, written
content, visual assets, and brand materials except where a file or component
states otherwise.

It does not claim ownership of:

- third-party packages;
- third-party trademarks;
- public facts;
- general ideas, methods, or functionality;
- content carrying its own license notice.

## Third-party boundary

Third-party packages remain governed by their own licenses. `package.json` and
`package-lock.json` identify the dependency graph, while installed package
metadata and upstream distributions contain the applicable package notices.

Before distributing a source or binary bundle, the exact release dependency
graph should receive a separate notice and obligation review.

## Verification

The focused verifier must confirm:

- `package.json.private === true`;
- `package.json.license === "UNLICENSED"`;
- the root package entry in `package-lock.json` is `UNLICENSED`;
- package and lockfile dependency declarations still agree;
- the first-party and third-party boundary documents exist;
- no custom investment-evaluation notice was introduced;
- the canonical research brief still exists;
- the lockfile diff contains no dependency or integrity drift.

## Unknowns

This audit does not determine:

- whether every transitive package notice must be reproduced in a distributed
  build;
- whether trademark, patent, trade-secret, consumer, privacy, or contract law
  creates additional obligations;
- whether a future distribution model requires a different notice bundle;
- whether the current proprietary language is optimal for every jurisdiction.

Those questions require a separate founder decision and, where appropriate,
qualified legal review.

## Rollback

Revert the eventual focused merge commit. No product, price, checkout, Stripe,
customer, database, domain, deployment, account, message, or external system
cleanup is required.

Do not delete stale PR #5 or its branch. Close it unmerged only after the focused
replacement is merged and linked as the superseding evidence.
