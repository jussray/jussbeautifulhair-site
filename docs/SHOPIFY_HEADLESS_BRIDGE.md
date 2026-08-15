# Shopify Headless Commerce Bridge

## Purpose

Keep the existing Juss Beautiful Hair React/Vite experience on the Cloudflare front door while Shopify owns live sellable catalog state, cart creation, checkout, payment, tax, and order creation.

The public storefront must never invent inventory, copy Shopify prices into a second sellable catalog, expose Admin credentials, or become the owner/order backend. Shopify remains the commerce source of truth; Cloudflare remains the branded public delivery layer; `jussray/jbh-private` remains the private paid-order/procurement authority.

## Cross-repository contract

The public and private repositories share `.control-room/commerce-seam.json` under contract `jbh-shopify-private-orders@v1`.

```text
public repository: jussray/jussbeautifulhair-site
private repository: jussray/jbh-private
shop domain: 8qp1z2-az.myshopify.com
Storefront API version: 2026-07
physical catalog vendor boundary: JBH
physical catalog route: /api/shopify/catalog
physical cart route: /api/shopify/cart
Shopify paid topic: orders/paid
private paid-order webhook path: /webhooks/shopify/orders-paid
private Worker service: jbh-private-payment-control
Hair Match variant: gid://shopify/ProductVariant/50196622344435
Hair Match offer: jbh-hair-match-v1
```

No Shopify Admin token, app secret, password, webhook secret, customer record, vendor identity, supplier SKU, supplier cost, or private order state belongs in browser code or `VITE_` variables.

A merge in either repository is not proof that the private Shopify paid-order integration is active. Production activation is provider-backed and must prove the private Worker hostname, runtime bindings, Shopify webhook subscription, intended database migration, and signed webhook behavior.

## Physical-product runtime flow

1. The browser renders the existing JBH visual shell.
2. `GET /api/shopify/catalog` reaches the Cloudflare Worker.
3. The Worker calls the tokenless Shopify Storefront API and requests only products in the public `JBH` vendor boundary.
4. The Worker normalizes live product handles, images, descriptions, prices, variant GIDs, and availability for the React storefront.
5. The browser stores the selected Shopify variant GID in a session-scoped cart. The old static cart key is not reused.
6. At checkout, the browser sends only `merchandiseId` and `quantity` to `POST /api/shopify/cart`.
7. Before creating a cart, the Worker re-reads every submitted variant from Shopify and requires the variant and its product to be available for sale and the product vendor to be exactly `JBH`.
8. The Worker calls Shopify `cartCreate`, validates that the returned checkout URL is HTTPS and on an approved Shopify/branded checkout host, and returns Shopify-computed cart totals.
9. If Shopify returns `jussbeautifulhair.com/cart/c/...`, the browser changes only the hostname to `8qp1z2-az.myshopify.com` while preserving the exact cart path and query string, including Shopify's required checkout key. This avoids the Cloudflare SPA route collision without reconstructing the checkout URL.
10. The browser redirects to Shopify. Shopify owns final availability, discounts, shipping, taxes, payment, and order creation.
11. After Shopify records a paid order, the separate private control plane is expected to receive the `orders/paid` event at `/webhooks/shopify/orders-paid`, verify the signed raw body and exact shop domain, store the private paid-order receipt, and initialize procurement state. That final provider wiring must be proven separately before it is called active.

The browser does not send product prices to the Worker as authority, and the Worker does not accept arbitrary Shopify variants outside the approved vendor boundary.

## Hair Match flow

Hair Match remains a separate fixed service offer using the approved tokenless Shopify cart permalink for the specific variant. Four bounded, non-sensitive preferences are attached as cart attributes. The Hair Match page continues to state that the purchase is not a physical hair order.

The private order-control layer treats service-only Hair Match orders separately from physical procurement and must not route them as hair fulfillment orders.

## Legacy Stripe boundary

The older `/api/checkout` and Checkout Session verification code remains server-side only as a reversible rollback path during this migration. The active physical-product React checkout does not call that route or present Stripe as the customer handoff.

Removing the legacy Stripe surface is a separate cleanup gate after the Shopify physical path has production proof and rollback requirements are reassessed.

## Release gates

Before calling the public physical bridge live, one exact head must prove all of the following:

- TypeScript and focused Shopify contracts pass.
- `npm run verify:commerce-seam` passes against the shared cross-repo contract.
- The production build passes.
- Desktop and mobile Playwright prove Shop → Product → Cart → Checkout while preserving the current JBH presentation, avoiding horizontal overflow, keeping the console clean, and sending only Shopify variant GIDs plus quantities.
- The checkout regression proves a branded `jussbeautifulhair.com/cart/c/...` URL escapes to the canonical `.myshopify.com` host without changing the cart path or key.
- A live no-payment Storefront API smoke test returns `JBH` products, finds at least one sellable variant, creates a one-line Shopify cart, and receives an approved HTTPS checkout URL without submitting an order or payment.
- The Hair Match exact-head Playwright proof stays green.
- The branch is current with `main`, review threads are clear, and merge uses expected-head protection.
- Production deployment proof is checked separately after merge before any public launch-complete claim.

Before calling the public/private paid-order seam active, provider-backed proof must additionally show:

- the private `jbh-private-payment-control` Worker is deployed on one approved custom hostname;
- `/health` returns the expected private service identity on that hostname;
- `SHOPIFY_SHOP_DOMAIN` resolves to `8qp1z2-az.myshopify.com` in the private runtime and `SHOPIFY_WEBHOOK_SECRET` is configured outside source;
- Shopify has an `orders/paid` subscription targeting the exact private `/webhooks/shopify/orders-paid` endpoint;
- `admin/migrations/008_shopify_physical_procurement.sql` is applied to the intended private database;
- a signed synthetic paid-order delivery is accepted exactly once, a duplicate is idempotent, and invalid signature/shop/topic cases fail closed.

## Analytics baseline

Treat Shopify sessions → cart additions → reached checkout → completed checkout as the public commerce funnel. Compare the post-deploy funnel against the pre-bridge baseline rather than treating a successful deploy as proof of conversion or private-order ingestion.

## Rollback

For the public bridge, revert the focused Shopify physical-bridge merge to restore the prior public checkout path. Do not alter Shopify product, inventory, fulfillment, order, or customer records merely to roll back repository code.

If the private paid-order seam is later activated, disable the Shopify webhook/private route before rolling back the private Worker, preserve already-received paid-order evidence, and handle database-record deletion only through a separate explicit retention decision.
