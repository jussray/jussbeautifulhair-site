# Juss Beautiful Hair — Public Storefront

> **Copyright © 2024–2026 Juss Ray. All rights reserved.**
> This is proprietary software. No license to use, copy, modify, distribute,
> sublicense, or create derivative works is granted. See [LICENSE](LICENSE).

Public storefront for Juss Beautiful Hair.

**Stack:** React + Vite + Tailwind CSS + Cloudflare Worker

**Active physical-commerce handoff:** Shopify Storefront Cart + Shopify-hosted checkout. Shopify owns sellable catalog state, cart creation, final availability, discounts, shipping, taxes, payment, and order creation. The Cloudflare storefront remains the branded delivery layer.

The older Stripe checkout surface remains server-side only as a reversible rollback path while the Shopify physical-product flow earns production proof. It is not the active physical-product customer handoff.

See [`docs/SHOPIFY_HEADLESS_BRIDGE.md`](docs/SHOPIFY_HEADLESS_BRIDGE.md) for the current commerce contract.

## Security boundary

This repository may contain only customer-facing storefront code and the minimal Cloudflare public-commerce Worker surface.

Do not add:

- private admin pages or owner authentication code;
- vendor names, sourcing files, private pricing, outreach records, or factory documents;
- customer/order schemas, database clients, database exports, or public order-detail APIs;
- Vercel functions, alternate deployment manifests, or setup scripts that recreate legacy APIs;
- Shopify Admin tokens, app secrets, customer credentials, Stripe secret keys, webhook signing secrets, Cloudflare API tokens, or `.env` files.

The private owner/admin, order-processing backend, webhook processing, and vendor control source belongs only in `jbh-private`.

## Current commerce flow

For physical products:

1. The browser renders the existing JBH React/Vite storefront.
2. `GET /api/shopify/catalog` reaches the Cloudflare Worker.
3. The Worker reads live public Shopify Storefront data only inside the approved `JBH` vendor boundary.
4. The browser keeps selected Shopify variant GIDs in a session-scoped cart.
5. Checkout sends only `merchandiseId` and `quantity` to `POST /api/shopify/cart`.
6. The Worker revalidates submitted variants against Shopify before cart creation.
7. Shopify `cartCreate` returns the checkout URL and Shopify-computed cart totals.
8. If Shopify returns a branded `jussbeautifulhair.com/cart/...` checkout URL, the client preserves the exact cart path and key while switching only the colliding hostname to the canonical `.myshopify.com` shop host.
9. The browser redirects to Shopify for checkout and payment.

The browser does not send product prices as authority, and the Worker does not accept arbitrary variants outside the approved public catalog boundary.

Hair Match remains a separate bounded Shopify offer as documented in `docs/SHOPIFY_HEADLESS_BRIDGE.md`.

## Legacy Stripe boundary

The historical `/api/checkout` and Stripe Checkout Session verification code remains server-side as a rollback surface during the Shopify migration. Do not describe that legacy route as the active physical-product checkout.

Removing the legacy Stripe path is a separate cleanup gate after the Shopify path has production proof.

## Build and verification

```bash
npm ci
npm run check
npm run verify:deploy
```

`verify:deploy` builds the storefront and checks the production-boundary rules, including:

- `workers_dev` disabled;
- public Preview URLs disabled;
- default deployment unable to claim the branded root hostname;
- exactly one separately approved `jussbeautifulhair.com/*` front-door Worker Route;
- no temporary/aliased preview command in package scripts or GitHub Actions;
- no deprecated Cloudflare Workers KV namespace-management route;
- no Vercel manifest/API directory, public database schema/client, or numeric order-lookup route;
- no known private-admin/vendor artifact in `dist/public/`;
- no private control-layer directory in this public repository.

The Vite storefront builds to `dist/public/`. `worker/index.ts` owns the bounded public API surfaces before static assets.

The Shopify physical path also has focused source contracts and desktop/mobile Playwright proof. Production deployment evidence remains separate from repository proof.

## Cloudflare production-only configuration

The default `wrangler.toml` is deliberately route-free and sets:

```toml
workers_dev = false
preview_urls = false
```

The separately gated `wrangler.frontdoor.toml` contains the approved production Worker Route:

```toml
[[routes]]
pattern = "jussbeautifulhair.com/*"
zone_name = "jussbeautifulhair.com"
```

That front-door configuration is an explicit activation surface, not the ordinary branch/default deploy path. Shopify remains the commerce source of truth behind the branded Cloudflare experience.

The Worker rejects unapproved storefront hostnames. A mistakenly exposed `workers.dev` or preview hostname must not become an alternate production storefront.

Optional runtime variable when more than one public origin is intentionally supported:

```text
ALLOWED_STOREFRONT_ORIGINS=https://<PRIMARY_STORE_ORIGIN>,https://<SECONDARY_STORE_ORIGIN>
```

Do not prefix secrets with `VITE_`. Vite variables are browser-readable.

## Checkout protections

The active physical-product path:

- accepts only Shopify variant GIDs and quantities as cart input;
- re-reads submitted variants from Shopify before cart creation;
- requires products to remain sellable and inside the approved `JBH` public catalog boundary;
- refuses malformed or unapproved checkout URLs;
- preserves exact Shopify cart identity while escaping the branded-host routing collision to the canonical shop host;
- leaves shipping, taxes, payment, and order creation to Shopify;
- does not expose Admin credentials or customer/order records to the browser.

The order-mutation webhook and owner/admin APIs do not belong in this public repository. The public site must not expose order details by sequential or user-supplied IDs.

## Deployment

Cloudflare Workers Builds should continue to run the normal verification lane:

```bash
npm run verify:deploy
```

Normal branch/default deployment uses route-free `wrangler.toml`; it must not be repurposed to claim `jussbeautifulhair.com`.

Production front-door activation is separately gated by `.github/workflows/frontdoor-activate.yml`. That workflow requires exact-current-main authority, explicit activation confirmation, the required Cloudflare production credentials, repository contracts, dry-run proof, exact-route verification, and live desktop/mobile Playwright after activation. Its rollback removes only a newly-created exact JBH Worker Route when the post-activation proof fails.

Repository merge, Worker upload, or a successful build is not by itself production-commerce proof. Keep source, CI, Cloudflare routing, Shopify cart/checkout, and live browser evidence separate.

Do not use temporary deployments, Preview URLs, preview aliases, Vercel, or a `workers.dev` production route.

## Documentation rule

Current `main` implementation and exact evidence outrank stale prose. Historical Stripe documentation may remain historical, but current-state docs must not present Stripe as the active physical-product checkout while the Shopify Cart path is the implemented customer handoff.

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).
