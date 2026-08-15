# Juss Beautiful Hair — Public Storefront

> **Copyright © 2024–2026 Juss Ray. All rights reserved.**
> This is proprietary software. No license to use, copy, modify, distribute,
> sublicense, or create derivative works is granted. See [LICENSE](LICENSE).

Public storefront for Juss Beautiful Hair.

**Stack:** React + Vite + Tailwind CSS + Cloudflare Worker

**Active physical commerce:** Shopify Storefront API + Shopify-hosted checkout. Shopify owns live sellable catalog state, final availability, discounts, shipping, taxes, payment, and order creation.

**Legacy rollback path:** Stripe Checkout/session verification remains server-side only for reversible rollback during the Shopify migration. The active physical-product React checkout does not use Stripe as the customer handoff.

## Cross-repository commerce seam

The public/private boundary is locked by `.control-room/commerce-seam.json` under contract `jbh-shopify-private-orders@v1`.

- Public storefront, Shopify catalog/cart bridge, and customer checkout entry: `jussray/jussbeautifulhair-site`.
- Private paid-order intake, customer/order persistence, procurement, vendor routing, and owner controls: `jussray/jbh-private`.
- Canonical Shopify shop: `8qp1z2-az.myshopify.com`.
- Public physical catalog boundary: Shopify vendor `JBH`.
- Public cart route: `/api/shopify/cart`.
- Shopify paid-order topic: `orders/paid`.
- Private paid-order webhook path: `/webhooks/shopify/orders-paid`.

Repository merges do **not** prove the private production integration is active. Live activation requires external provider evidence for the private Worker hostname, Shopify webhook subscription, runtime bindings, intended database migration, and signed webhook behavior.

Run `npm run verify:commerce-seam` to fail closed if the public half drifts from this contract.

## Security boundary

This repository may contain only customer-facing storefront code and the minimal public Cloudflare commerce Worker.

Do not add:

- private admin pages or owner authentication code;
- vendor names, sourcing files, pricing, outreach records, or factory documents;
- customer/order schemas, database clients, database exports, or public order-detail APIs;
- Vercel functions, alternate API authorities, or setup scripts that recreate legacy APIs;
- Stripe secret keys, Shopify Admin credentials, webhook signing secrets, Cloudflare API tokens, or `.env` files.

The private owner/admin, order-processing backend, signed paid-order webhook processing, and vendor control source belongs only in `jbh-private`.

## Build and verification

```bash
npm ci
npm run check
npm run verify:commerce-seam
npm run verify:deploy
```

`verify:commerce-seam` checks the public source against the shared public/private Shopify contract.

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

The Vite storefront builds to `dist/public/`. The gated Cloudflare front-door configuration runs `worker/index.ts` before static assets so `/api/shopify/*`, `/version`, and rollback-only payment routes are handled server-side.

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

The front-door configuration is an explicit activation surface, not the normal branch/default deploy path. Cloudflare requires the root DNS record to be proxied before a Worker Route can invoke.

The Worker independently rejects requests whose hostname is not derived from `STORE_ORIGIN` or `ALLOWED_STOREFRONT_ORIGINS`. This makes a mistakenly created `workers.dev` or temporary preview hostname return a generic `404` instead of serving storefront assets or commerce APIs.

A separate hosting-provider deployment or badge is not proof of the branded front door. This repository does not authorize Vercel API functions as a second commerce backend. Production proof must identify the exact deployed source SHA and the actual front-door behavior.

Configure secrets in Cloudflare without placing values in GitHub. Do not prefix secrets with `VITE_`; Vite variables are readable by browsers.

### Workers KV management API

The storefront currently contains no direct Cloudflare Workers KV namespace-management client. Runtime KV bindings, if added later, should be configured through Wrangler bindings. Any future direct Cloudflare API integration must use the current documented API surface and must keep API tokens, namespace identifiers, stored event identifiers, and values out of source and logs.

## Active Shopify checkout protections

For physical products the Worker and browser enforce these boundaries:

- `GET /api/shopify/catalog` reads live Shopify catalog state and exposes only the public `JBH` vendor boundary;
- the browser stores Shopify variant GIDs, not client-authoritative prices;
- `POST /api/shopify/cart` accepts only Shopify `merchandiseId` + quantity;
- before cart creation, the Worker re-reads submitted variants from Shopify and requires the variant/product to remain sellable and the product vendor to remain exactly `JBH`;
- Shopify `cartCreate` computes cart totals and returns the checkout URL;
- approved branded Shopify checkout URLs are normalized in the browser to the canonical `.myshopify.com` host while preserving the exact cart path and required query key, preventing the Cloudflare SPA from swallowing `/cart/c/*`;
- Shopify owns final discounts, shipping, taxes, payment, and order creation.

The older `/api/checkout` and Checkout Session verification routes are rollback-only. They must not be presented as the active physical checkout path while the Shopify bridge is active.

The order-mutation webhook and owner/admin APIs do not belong in this public repository. The public site must not expose private order details, vendor identities, supplier SKUs, costs, margins, procurement state, or owner controls.

## Deployment

Cloudflare Workers Builds should continue to run the normal verification lane:

```bash
npm run verify:deploy
```

Normal branch/default deployment uses route-free `wrangler.toml`; it must not be repurposed to claim `jussbeautifulhair.com`.

Production front-door activation is separately gated by `.github/workflows/frontdoor-activate.yml`. That manual workflow requires:

- the exact current `main` SHA;
- explicit `jussbeautifulhair.com` and activation confirmations;
- provider-held Cloudflare credentials;
- a proxied Cloudflare root DNS record;
- repository contracts and a Wrangler dry run before deployment;
- live desktop/mobile proof against the branded storefront after activation.

Do not treat a branch preview, provider badge, successful merge, or repository setting as proof that the public/private order path is fully active. The private half has its own external activation proof requirements in the shared commerce seam contract.

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).
