# Juss Beautiful Hair Contact Recovery /futureyou Handoff

## Who

Ray/Juss is the founder and data decision owner. Storefront visitors may submit questions, styling requests, collaboration notes, or wholesale inquiries. Repository agents may implement and verify the public form but may not deploy a customer-data service, create CRM records, send replies, or change retention without the applicable founder gate.

## What

Restore a truthful contact path without turning the public payment-session Worker into a customer-data backend.

The public storefront:

- renders the contact form and Cloudflare Turnstile challenge;
- requires explicit consent before submission;
- submits only to the configured `VITE_CONTACT_API_URL`;
- shows “Message received” only after the private service confirms persistence;
- displays a receipt only when the service returns a stored receipt;
- treats a recent duplicate as already received without inventing a second receipt;
- retains Instagram as the operational fallback.

The canonical private ingress contract is stacked in `jussray/jbh-private` PR #35 at exact head `29e38dfafa9809277f98a4c72fb86ff7de998c69`.

That branch is structurally assembled but **BLOCKED** by `jussray/jbh-private` issue #36 because GitHub Actions stops in `startup_failure` before creating jobs. It is not approved for merge or activation.

## Where

Public repository: `jussray/jussbeautifulhair-site`.

Public files:

- `client/src/pages/Contact.tsx`;
- `worker/index.ts` for CSP configuration only;
- `tests/contact-recovery-contract.test.mjs`;
- `.github/workflows/contact-recovery-exact-head.yml`.

Canonical private customer-data ingress: `jussray/jbh-private/contact-worker` on PR #35.

Historical source only: `jussray/jussbeautifulhair1/contact-worker`.

The duplicate repository's callable deployment authority was retired on exact main commit `64ea67290e161debdae5cb9a9e3f8f27fab4842b`. It must not deploy `jbh-contact-ingress`.

## When

Do not represent this public contact path as operational until:

1. `jussray/jbh-private` issue #36 is resolved and the exact PR #35 head receives real jobs, steps, logs, and artifacts;
2. private PR #35 and its parent private backend layers pass every required exact-head gate and are separately approved for merge;
3. `admin/migrations/001_init.sql` and `admin/migrations/007_contact_ingress_safety.sql` are applied to the intended private Neon database through a separately approved migration action;
4. the private Worker has its Turnstile and Neon secrets configured without exposing their values;
5. one approved HTTPS route is attached to the private Worker;
6. public `VITE_CONTACT_API_URL`, `VITE_TURNSTILE_SITE_KEY`, and Worker `CONTACT_API_ORIGIN` values match that route;
7. exact-head public checks pass;
8. a desktop and mobile browser submission returns a real receipt and creates exactly one database row;
9. duplicate, invalid-origin, invalid-hostname, invalid-consent, honeypot, oversized-body, and invalid-Turnstile cases fail closed;
10. the historical duplicate repository remains non-deploying.

## Why

The production contact form previously posted to a missing `/api/contact` route. The first repair placed `DATABASE_URL` and direct Neon writes in the public payment Worker and relied on CORS as abuse prevention. Review correctly rejected both decisions.

A later narrow private ingress was implemented in the duplicate storefront repository. Its runtime boundaries were useful, but the repository authority was wrong. The current consolidation moves that isolated service under `jbh-private`, where customer records, paid orders, vendors, sourcing, margins, fulfillment, and owner controls already belong.

## How

- Keep the public Worker limited to static assets and server-created Stripe Checkout sessions.
- Load Turnstile from `https://challenges.cloudflare.com` under a narrow CSP.
- Permit browser requests only to the exact non-secret `CONTACT_API_ORIGIN` configured in the public Worker.
- Keep the full contact endpoint in `VITE_CONTACT_API_URL`; reject non-HTTPS endpoints outside local development.
- Require explicit privacy consent, a hidden honeypot, and a server-verified Turnstile token.
- Display a persistence receipt only when the private service returns one.
- Keep contact persistence, database credentials, duplicate fingerprints, customer messages, and private operational controls inside `jbh-private`.
- Maintain one deployment authority only. The duplicate repository may retain historical source but no production deploy command.
- Do not treat a Pages preview, configured variable, successful merge, Cloudflare badge, or connector authorization as proof that a message was stored.

## Known

- `jbh-private/admin/migrations/001_init.sql` defines `contact_messages`.
- PR #35 adds the additive safety migration `admin/migrations/007_contact_ingress_safety.sql`.
- The public privacy policy discloses contact-message retention and Neon storage.
- The public Worker has no Neon import, no `DATABASE_URL`, and no `/api/contact` persistence route.
- The canonical private branch contains a distinct `jbh-contact-ingress` Worker with workers.dev and preview URLs disabled.
- The duplicate repository's deployment workflow is now a verified no-deploy guard on main `64ea67290e161debdae5cb9a9e3f8f27fab4842b`.
- No customer record, route, secret, migration, or live Worker was changed by the authority correction.

## Inferred

A separate ingress under the owner-only backend reduces the public Worker’s authority and makes abuse controls, data retention, vendor/customer separation, and future CRM synchronization independently reviewable.

## Assumed

An approved custom hostname can be assigned to the canonical private Worker. This remains an assumption until Cloudflare route evidence exists.

## Unknown

- The final private contact-service hostname.
- Whether production Neon migrations and Cloudflare secrets are configured.
- Whether GitHub Actions execution for `jbh-private` has been restored.
- The intended contact-message retention period.
- Who reviews the private inquiry queue and at what cadence.
- Whether approved inquiries will later synchronize to HubSpot.

## Blocked

Production deployment, migration execution, secret mutation, CRM writes, live customer submissions, automated replies, and external publication are not authorized by this repository change alone.

The private implementation is additionally blocked by `jussray/jbh-private#36` until GitHub creates real jobs and executes every required exact-head gate.

## Verification

Static public proof must show:

- no Neon import, `DATABASE_URL`, or contact persistence in `worker/index.ts`;
- exact Turnstile and contact-service CSP sources only;
- explicit consent, honeypot, security token, HTTPS endpoint validation, duplicate handling, and receipt handling in the public form;
- the handoff names `jussray/jbh-private` as the canonical private authority;
- the handoff records `jussray/jussbeautifulhair1` as historical and non-deploying;
- build and TypeScript success on one immutable head.

Private static proof must execute on the exact PR #35 head and include strict TypeScript, customer-data and abuse-boundary contracts, additive migration checks, named-config Wrangler dry-run, retained bundle artifact, inherited private order/vendor/security/browser gates, and zero unresolved critical review threads.

Runtime proof must show the exact public and private deployments, tested hostnames, response receipt, one database row, negative abuse cases, screenshots, console state, duplicate-repository non-deployment, and rollback path.

## Rollback

Remove `VITE_CONTACT_API_URL` and `VITE_TURNSTILE_SITE_KEY`, remove `CONTACT_API_ORIGIN`, and revert the public form/CSP change. The form will fail closed and continue showing Instagram as fallback.

If the private ingress is later activated, disable its route before redeploying the prior known-good private backend. Preserve stored contact messages and handle deletion only through a separate explicit data decision. Never restore two simultaneous deployment authorities.

## Next owner

Founder or designated operator must first restore executable GitHub Actions for `jbh-private` under issue #36. After exact-head proof, the operator must separately approve the private merges, service hostname, migration, secrets, deployment, public environment values, browser/database proof, retention policy, inquiry ownership, and any future HubSpot synchronization.
