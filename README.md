# Juss Beautiful Hair — Public Storefront

> **Copyright © 2024–2026 Juss Ray. All rights reserved.**
> This is proprietary software. No license to use, copy, modify, distribute,
> sublicense, or create derivative works is granted. See [LICENSE](LICENSE).

Public storefront for Juss Beautiful Hair.

**Stack:** React + Vite + Tailwind CSS + Cloudflare Worker

**Payments:** Stripe-hosted Checkout. Secret keys remain in Cloudflare Worker secrets and are never bundled into browser JavaScript.

## Security boundary

This repository may contain only customer-facing storefront code and the minimal Cloudflare payment-session Worker.

Do not add:

- private admin pages or owner authentication code;
- vendor names, sourcing files, pricing, outreach records, or factory documents;
- customer/order schemas, database clients, database exports, or public order-detail APIs;
- Vercel functions, alternate deployment manifests, or setup scripts that recreate legacy APIs;
- Stripe secret keys, webhook signing secrets, Cloudflare API tokens, or `.env` files.

The private owner/admin, order-processing backend, webhook processing, and vendor control source belongs only in `jbh-private`.

## Build and verification

```bash
npm ci
npm run check
npm run verify:deploy
```

`verify:deploy` builds the storefront and then checks that:

- `workers_dev` is explicitly disabled;
- public Preview URLs are explicitly disabled;
- automatic/default deployment remains unable to claim the branded root hostname;
- the explicit front-door config contains exactly one approved `jussbeautifulhair.com/*` Worker Route;
- no temporary or aliased preview command is present in package scripts or GitHub Actions;
- no deprecated Cloudflare Workers KV namespace-management route exists in source, scripts, workflows, or documentation;
- no Vercel manifest, Vercel API directory, public database schema, public database client, or numeric order-lookup route exists;
- no known private-admin or vendor artifact appears in `dist/public/`;
- no private control-layer directory has been added to this repository.

The Vite storefront builds to `dist/public/`. Wrangler deploys that directory with `worker/index.ts` handling `/api/checkout` before static assets.

## Cloudflare production-only configuration

The default `wrangler.toml` is deliberately route-free and explicitly sets:

```toml
workers_dev = false
preview_urls = false
```

That default configuration can build or update the Worker without silently claiming the branded root hostname.

The separately gated `wrangler.frontdoor.toml` contains the one approved production Worker Route:

```toml
[[routes]]
pattern = "jussbeautifulhair.com/*"
zone_name = "jussbeautifulhair.com"
```

The front-door configuration is an explicit activation surface, not the normal branch/default deploy path. It keeps Shopify attached as the commerce origin while Cloudflare can run the custom JBH Worker in front of the existing hostname. Cloudflare requires the root DNS record to be proxied before a Worker Route can invoke.

The Worker independently rejects requests whose hostname is not derived from `STORE_ORIGIN` or `ALLOWED_STOREFRONT_ORIGINS`. This makes a mistakenly created `workers.dev` or temporary preview hostname return a generic `404` instead of serving storefront assets or Checkout.

Configure secrets in Cloudflare without placing values in GitHub:

```bash
wrangler secret put STRIPE_SECRET_KEY
```

Optional runtime variable when more than one public origin is intentionally supported:

```text
ALLOWED_STOREFRONT_ORIGINS=https://<PRIMARY_STORE_ORIGIN>,https://<SECONDARY_STORE_ORIGIN>
```

Do not prefix secrets with `VITE_`. Vite variables are readable by browsers.

### Workers KV management API

The storefront currently contains no direct Cloudflare Workers KV namespace-management client. Runtime KV bindings, if added later, should be configured through Wrangler bindings. Any future direct Cloudflare API integration must use the documented `/storage/kv/namespaces` route and must keep `<CLOUDFLARE_API_TOKEN>`, namespace identifiers, stored event identifiers, and values out of source and logs.

The deployment verifier fails when the deprecated namespace-management route is introduced anywhere in tracked repository text files.

## Checkout protections

The Worker:

- serves only approved storefront hostnames plus local loopback development;
- accepts product ID, variant, quantity, and a random checkout-attempt ID only;
- resolves prices and shipping from the server-side catalog;
- rejects unknown products, variants, oversized payloads, and unapproved origins;
- uses a Stripe idempotency key for each checkout attempt;
- sends customers to Stripe to provide payment, contact, billing, and shipping details;
- returns generic errors and does not log customer data or credentials;
- applies restrictive security headers to storefront assets.

The order-mutation webhook and owner/admin APIs do not belong in this public repository. The public site must not expose order details by sequential or user-supplied IDs. The success page displays only a truncated Stripe session reference and does not fetch customer or order records.

## Deployment

Cloudflare Workers Builds should continue to run the normal verification lane:

```bash
npm run verify:deploy
```

Normal branch/default deployment uses route-free `wrangler.toml`; it must not be repurposed to claim `jussbeautifulhair.com`.

Production front-door activation is separately gated by `.github/workflows/frontdoor-activate.yml`. That manual workflow requires:

- the exact current `main` SHA;
- explicit `jussbeautifulhair.com` and activation confirmations;
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets;
- a proxied Cloudflare root DNS record;
- no pre-existing JBH Worker route;
- repository contracts and a Wrangler dry run to pass before deployment.

It pins Wrangler, deploys only `wrangler.frontdoor.toml`, confirms the exact route maps to `jussbeautifulhair-site`, and runs live desktop/mobile Playwright proof against `https://jussbeautifulhair.com`. If any post-activation step fails, the workflow removes only the newly-created exact JBH Worker Route before finishing failed.

Do not use temporary deployments, Preview URLs, preview aliases, Vercel, or a `workers.dev` production route.

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).
