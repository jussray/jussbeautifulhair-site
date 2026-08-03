# Control Room Current-Main Recovery Record

## Authority

- **Decision owner:** Juss Ray
- **Repository:** `jussray/jussbeautifulhair-site`
- **Operational reader:** Founder Control Room and future repository agents

## Current contract

The Founder Control Room manifest describes repository capabilities that are active on `main` only when their evidence paths and usage assertions are present and the required exact-head signal passes.

Active public capabilities currently include:

- public storefront routing and shared cart state;
- server-authoritative Stripe Checkout Session creation;
- public/private source separation;
- production-only Cloudflare Worker and asset boundaries;
- executable TypeScript, lint, test, AI-skill, deployment, and build checks;
- fail-closed validation of the returned Stripe Checkout URL immediately before browser navigation.

Private verified contact persistence remains **planned**, not active. Public contact recovery documentation or UI does not prove that the private ingress, migrations, secrets, deployment, database write, or abuse controls are live.

## Checkout redirect reconciliation

PR #29 merged the checkout redirect integrity implementation into `main` after the original Control Room replacement was prepared.

The active capability is grounded in:

- `client/src/pages/Checkout.tsx`;
- `client/src/lib/checkoutRedirect.mjs`;
- `tests/checkout-redirect-contract.test.mjs`;
- `.github/workflows/checkout-redirect-exact-head.yml`.

The repository contract verifies that browser navigation uses the shared validator, requires HTTPS and the exact Stripe Checkout origin, rejects embedded credentials, rejects custom ports, and covers malformed and lookalike destinations in the focused test.

## Control Room files

- Manifest: `.control-room/repository.manifest.json`
- Verifier: `scripts/verify-control-room-manifest.mjs`
- Exact-head workflow: `.github/workflows/control-room-current-main-exact-head.yml`
- Recovery record: `docs/CONTROL_ROOM_FUTUREYOU.md`

## Verification loop

1. Check out the immutable PR head or pushed `main` SHA.
2. Verify the checked-out SHA before executing repository commands.
3. Run locked dependency installation, TypeScript, lint, repository tests, AI-skill verification, deployment-boundary verification, and the production build.
4. Validate manifest schema version `1.0`, repository identity, signal names, unique IDs, evidence-file existence, signal references, and every usage marker.
5. Emit only the allowlisted sanitized packet fields.
6. Treat skipped, stale, zero-step, missing-log, or runner-startup failures as infrastructure evidence, never as a pass.

Required provider signal:

```text
Verify current-main storefront contract
```

## Proof boundary

A passing contract proves the listed repository wiring and build-time boundaries at one exact commit. It does not prove:

- production deployment;
- live Stripe availability or payment completion;
- order creation, notification, inventory, fulfillment, or shipment;
- private contact ingestion, database persistence, or abuse-control deployment;
- customer outcomes.

## Rollback

Revert the focused manifest reconciliation commit. No catalog, price, checkout session, Stripe object, customer record, database row, domain, deployment, or external message requires cleanup.

Do not delete superseded branches or historical evidence.

## Next owner

- Keep checkout redirect integrity active while its evidence markers remain present.
- Keep private contact ingress planned until the canonical private implementation executes and passes its own exact-head, migration, secret, deployment, database, abuse-case, and rendered submission proof.
- Update the manifest and this record together whenever a capability changes state.
- Merge with expected-head protection only after the final exact-head workflow executes real steps and all review threads are resolved.
