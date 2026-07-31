# Control Room Current-Main Recovery Record

## Who

- **Decision owner:** Juss Ray.
- **Repository owner:** `jussray/jussbeautifulhair-site`.
- **Operational reader:** Founder Control Room and future repository agents.
- **Affected people:** storefront customers, the founder, future maintainers, and operators who rely on repository status packets.

## What

This record accompanies the current-main Founder Control Room manifest, repo-local verifier, and immutable-head workflow.

The contract describes what is actually active on `main`:

- public storefront routing and shared cart state;
- server-authoritative Stripe Checkout Session creation;
- public/private source separation;
- production-only Cloudflare Worker and asset boundaries;
- executable TypeScript, lint, test, AI-skill, deployment, and build checks.

It also keeps these capabilities explicitly **planned**, not active:

- browser validation of the returned Stripe Checkout URL, currently proposed in public PR #29;
- private verified contact ingress, currently proposed across public PR #28 and private PR #6.

## Where

- Manifest: `.control-room/repository.manifest.json`
- Verifier: `scripts/verify-control-room-manifest.mjs`
- Exact-head workflow: `.github/workflows/control-room-current-main-exact-head.yml`
- Recovery record: `docs/CONTROL_ROOM_FUTUREYOU.md`
- Superseded source branch: public PR #11, `feat/control-room-repository-manifest`

## When

This replacement was prepared on July 31, 2026 against the then-current `main` commit.

Re-run the exact-head gate whenever the manifest, its active evidence paths, checkout wiring, deployment boundary, quality scripts, or relevant workflows change.

## Why

PR #11 carried a useful Control Room concept and two valid historical code repairs, but its branch was no longer safe to merge:

- the catalog re-export and Stripe API-version repairs already exist on current `main`;
- its manifest said lint and unit tests were planned even though current `main` now has executable lint, unit-test, AI-skill, and deployment-boundary contracts;
- its required signal names reflected an older workflow layout;
- it did not know about the production-only hostname boundary, current deployment verifier, draft checkout-redirect work, or split private-contact architecture.

The replacement preserves the durable manifest idea without importing stale workflow or runtime code.

## How

1. The workflow checks out the immutable PR head or pushed `main` SHA.
2. It verifies the checked-out SHA before executing repository commands.
3. It runs locked dependency installation, TypeScript, lint, repository tests, AI-skill verification, source deployment verification, production build, and built-output deployment verification.
4. The manifest verifier validates schema version `1.0`, repository identity, required provider check name, unique IDs, active evidence-file existence, required-signal references, and every usage marker.
5. The verifier writes a sanitized packet containing commit, branch, manifest hash, check status, capability IDs, evidence paths, and failed assertion IDs only.
6. Source text, assertion markers, logs, secrets, customer data, vendor records, and private operations are excluded from the packet.

## Known

- Current `main` mounts `/shop`, `/cart`, `/checkout`, and `/success` under the shared `CartProvider`.
- The public browser sends catalog identifiers, variants, quantities, and a checkout-attempt UUID to `/api/checkout`.
- The Worker resolves products and prices from `shared/catalog.ts`, checks approved origins and hostnames, and uses a Stripe idempotency key.
- `wrangler.toml` disables `workers_dev` and preview URLs, binds `dist/public`, and routes `/api/*` through the Worker first.
- Current `main` defines executable TypeScript, lint, Node contract tests, AI-skill verification, deployment-boundary verification, and production build commands.
- GitHub Actions has recently produced repeated zero-step, no-log runner-startup failures in this repository. Those are infrastructure evidence, not code verdicts and not passes.

## Inferred

- A single exact-head umbrella check is less likely to create false capability states than requiring several manual-only workflow check names that may not all exist on every commit.
- Keeping draft PR capabilities planned prevents Founder Control Room from treating proposal branches as production truth.

## Assumed

- Founder Control Room continues to accept repository manifest schema version `1.0` and the packet fields declared by its current TypeScript contract.
- The exact provider check name `Verify current-main storefront contract` remains stable unless this manifest and workflow are updated together.

## Unknown

- Whether the next GitHub-hosted runner will provision successfully.
- Whether Cloudflare Workers Builds will recover from the pre-existing deployment-integration failure.
- Whether the storefront's live Stripe, payment, notification, order, and fulfillment paths currently complete end to end.
- Whether PR #29, public PR #28, or private PR #6 will pass their separate runtime gates without further changes.

## Blocked

Merge is blocked until the final replacement head executes the exact-head workflow with real steps and logs, produces the sanitized packet, and has zero unresolved critical review threads.

A manifest file existing in the repository is not by itself proof that any capability passed.

## Verification

Required final-head receipt:

```text
Verify current-main storefront contract
```

That single provider check must execute all commands declared in the workflow and finish successfully on the immutable head. The retained artifact name must include that head SHA.

## Proof boundary

A passing contract proves repository wiring and the listed build-time boundaries at one commit. It does not prove:

- a production deployment occurred;
- Stripe is configured or available;
- payment completed;
- an order or notification was created;
- inventory, fulfillment, shipment, support, or customer outcomes;
- draft capabilities in PR #29, public PR #28, or private PR #6.

## Rollback

Revert the eventual focused manifest merge commit.

No catalog, price, checkout session, Stripe account, Cloudflare secret, customer record, database row, domain, deployment, message, branch, or external system requires cleanup. Do not delete the superseded PR #11 branch or evidence history.

## Next owner

The next repository operator should:

1. inspect the exact workflow receipt and sanitized artifact;
2. merge only with expected-head SHA protection after all gates pass;
3. close PR #11 unmerged with a link to the replacement only after the replacement is merged;
4. update planned capabilities to active only after their own exact-head and runtime proof is merged onto `main`;
5. preserve this public/private authority boundary during every future manifest update.
