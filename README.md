# Juss Beautiful Hair — Public Storefront

> **Copyright © 2024–2026 Juss Ray. All rights reserved.**
> This is proprietary software. No license to use, copy, modify, distribute,
> sublicense, or create derivative works is granted. See [LICENSE](LICENSE).

Public storefront for Juss Beautiful Hair.

**Stack:** React + Vite + Tailwind CSS + Cloudflare Worker

**Payments:** Stripe-hosted Checkout. Secret keys remain in Cloudflare Worker secrets and are never bundled into browser JavaScript.

## Security boundary

This repository may contain only customer-facing storefront code and the minimal payment-session Worker.

Do not add:

- private admin pages or owner authentication code;
- vendor names, sourcing files, pricing, outreach records, or factory documents;
- customer/order database exports;
- Stripe secret keys, webhook signing secrets, Cloudflare API tokens, or `.env` files.

The private owner/admin and vendor control source belongs only in `jbh-private`.

## Build and verification

```bash
npm ci
npm run check
npm run verify:deploy
```

`verify:deploy` builds the storefront and then checks that:

- `workers_dev` is explicitly disabled;
- public Preview URLs are explicitly disabled;
- no temporary or aliased preview command is present in package scripts or GitHub Actions;
- no known private-admin or vendor artifact appears in `dist/public/`;
- no private control-layer directory has been added to this repository.

The Vite storefront builds to `dist/public/`. Wrangler deploys that directory with `worker/index.ts` handling `/api/checkout` before static assets.

## Cloudflare production-only configuration

`wrangler.toml` explicitly sets:

```toml
workers_dev = false
preview_urls = false
```

Cloudflare must serve this Worker only through the approved custom storefront hostname. The Worker independently rejects requests whose hostname is not derived from `STORE_ORIGIN` or `ALLOWED_STOREFRONT_ORIGINS`. This makes a mistakenly created `workers.dev` or temporary preview hostname return a generic `404` instead of serving storefront assets or Checkout.

Configure the following in Cloudflare without placing values in GitHub:

```bash
wrangler secret put STRIPE_SECRET_KEY
```

Optional runtime variable when more than one public origin is intentionally supported:

```text
ALLOWED_STOREFRONT_ORIGINS=https://<PRIMARY_STORE_ORIGIN>,https://<SECONDARY_STORE_ORIGIN>
```

Do not prefix secrets with `VITE_`. Vite variables are readable by browsers.

## Checkout protections

The Worker:

- serves only approved storefront hostnames plus local loopback development;
- accepts product ID, variant, and quantity only;
- resolves prices and shipping from the server-side catalog;
- rejects unknown products, variants, oversized payloads, and unapproved origins;
- uses a Stripe idempotency key for each checkout attempt;
- sends customers to Stripe to provide payment, contact, billing, and shipping details;
- returns generic errors and does not log customer data or credentials;
- applies restrictive security headers to storefront assets.

The order-mutation webhook and private admin controls do not belong in this public repository.

## Deployment

Cloudflare Workers Builds should run:

```bash
npm run verify:deploy
```

Wrangler may then deploy the verified Worker and `dist/public/` assets using `wrangler.toml`. Do not use temporary deployments, Preview URLs, preview aliases, or a `workers.dev` production route.

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).
