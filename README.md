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
npm run build
```

The Vite storefront builds to `dist/public/`. Wrangler deploys that directory with `worker/index.ts` handling `/api/checkout` before static assets.

## Cloudflare configuration

`wrangler.toml` defines the public `STORE_ORIGIN`. Configure the following in Cloudflare without placing values in GitHub:

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
npm run build
```

Wrangler then deploys the Worker and `dist/public/` assets using `wrangler.toml`.

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).
