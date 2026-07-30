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

The private ingress contract lives in `jussray/jussbeautifulhair1` PR #6.

## Where

Public repository: `jussray/jussbeautifulhair-site`.

Public files:

- `client/src/pages/Contact.tsx`;
- `worker/index.ts` for CSP configuration only;
- `tests/contact-recovery-contract.test.mjs`;
- `.github/workflows/contact-recovery-exact-head.yml`.

Private customer-data ingress: `jussray/jussbeautifulhair1/contact-worker`.

## When

Do not merge this public PR as a completed customer path until:

1. private PR #6 is reviewed and merged;
2. the additive database migration is applied to the intended Neon database;
3. the private Worker has its Turnstile and Neon secrets configured;
4. an approved HTTPS route is attached to the private Worker;
5. public `VITE_CONTACT_API_URL`, `VITE_TURNSTILE_SITE_KEY`, and Worker `CONTACT_API_ORIGIN` values match that route;
6. exact-head public checks pass;
7. a desktop and mobile browser submission returns a real receipt and creates exactly one database row;
8. duplicate, invalid-origin, invalid-hostname, invalid-consent, honeypot, oversized-body, and invalid-Turnstile cases fail closed.

## Why

The production contact form previously posted to a missing `/api/contact` route. The first repair placed `DATABASE_URL` and direct Neon writes in the public payment Worker and relied on CORS as abuse prevention. Review correctly rejected both decisions.

## How

- Keep the public Worker limited to static assets and server-created Stripe Checkout sessions.
- Load Turnstile from `https://challenges.cloudflare.com` under a narrow CSP.
- Permit browser requests only to the exact non-secret `CONTACT_API_ORIGIN` configured in the public Worker.
- Keep the full contact endpoint in `VITE_CONTACT_API_URL`; reject non-HTTPS endpoints outside local development.
- Require explicit privacy consent, a hidden honeypot, and a server-verified Turnstile token.
- Display a persistence receipt only when the private service returns one.
- Do not treat a Pages preview, configured variable, successful merge, or connector authorization as proof that a message was stored.

## Known

- `migrations/001_init.sql` already defines `contact_messages`.
- The public privacy policy discloses contact-message retention and Neon storage.
- The public Worker is restored to no Neon import, no `DATABASE_URL`, and no `/api/contact` persistence route.
- Private PR #6 adds the proposed Turnstile-protected ingress contract.

## Inferred

A separate ingress reduces the public Worker’s authority and makes abuse controls, data retention, and future CRM synchronization independently reviewable.

## Assumed

An approved custom hostname can be assigned to the private Worker. This remains an assumption until Cloudflare route evidence exists.

## Unknown

- The final private contact-service hostname.
- Whether production Neon migrations and Cloudflare secrets are configured.
- The intended contact-message retention period.
- Who reviews the private inquiry queue and at what cadence.
- Whether approved inquiries will later synchronize to HubSpot.

## Blocked

Production deployment, migration execution, secret mutation, CRM writes, live customer submissions, and external publication are not authorized by this repository change alone.

## Verification

Static proof must show:

- no Neon import, `DATABASE_URL`, or contact persistence in `worker/index.ts`;
- exact Turnstile and contact-service CSP sources only;
- explicit consent, honeypot, security token, HTTPS endpoint validation, duplicate handling, and receipt handling in the public form;
- build and TypeScript success on one immutable head.

Runtime proof must show the exact public and private deployments, tested hostnames, response receipt, database row, negative abuse cases, screenshots, console state, and rollback path.

## Rollback

Remove `VITE_CONTACT_API_URL` and `VITE_TURNSTILE_SITE_KEY`, remove `CONTACT_API_ORIGIN`, and revert the public form/CSP PR. The form will fail closed and continue showing Instagram as fallback. Do not delete stored contact messages without a separate explicit deletion decision.

## Next owner

Founder or designated operator must approve the service hostname, configure both repositories’ environment values, apply migrations, deploy the private ingress, perform the browser/database proof, define retention and inquiry ownership, and then decide whether the public PR may merge as an operational recovery.
