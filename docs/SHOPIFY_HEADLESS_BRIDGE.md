# Shopify Headless Commerce Bridge

## Purpose

Keep the existing Juss Beautiful Hair React/Vite experience on the Cloudflare front door while Shopify owns live sellable catalog state, cart creation, checkout, payment, tax, and order creation.

The public storefront must never invent inventory, copy Shopify prices into a second sellable catalog, or expose Admin credentials. Shopify remains the commerce source of truth; Cloudflare remains the branded delivery layer.

## Approved public contract

```text
shop domain: 8qp1z2-az.myshopify.com
Storefront API version: 2026-07
physical catalog vendor boundary: JBH
physical catalog route: /api/shopify/catalog
physical cart route: /api/shopify/cart
Hair Match variant: gid://shopify/ProductVariant/50196622344435
Hair Match offer: jbh-hair-match-v1
```

No Shopify Admin token, app secret, password, webhook secret, or customer data belongs in browser code or `VITE_` variables.

## Physical-product runtime flow

1. The browser renders the existing JBH visual shell.
2. `GET /api/shopify/catalog` reaches the Cloudflare Worker.
3. The Worker calls the tokenless Shopify Storefront API and requests only products in the public `JBH` vendor boundary.
4. The Worker normalizes live product handles, images, descriptions, prices, variant GIDs, and availability for the React storefront.
5. The browser stores the selected Shopify variant GID in a session-scoped cart. The old static cart key is not reused.
6. At checkout, the browser sends only `merchandiseId` and `quantity` to `POST /api/shopify/cart`.
7. Before creating a cart, the Worker re-reads every submitted variant from Shopify and requires the variant and its product to be available for sale and the product vendor to be exactly `JBH`.
8. The Worker calls Shopify `cartCreate` and returns only an approved HTTPS checkout URL on the canonical `.myshopify.com` host plus Shopify-computed cart totals.
9. The browser redirects to Shopify. Shopify owns final availability, discounts, shipping, taxes, payment, and order creation.

The browser does not send product prices to the Worker as authority, and the Worker does not accept arbitrary Shopify variants outside the approved vendor boundary.

## Hair Match flow

Hair Match remains a separate fixed service offer using the approved tokenless Shopify cart permalink for the specific variant. Four bounded, non-sensitive preferences are attached as cart attributes. The Hair Match page continues to state that the purchase is not a physical hair order.

## Legacy Stripe boundary

The older `/api/checkout` and Checkout Session verification code remains server-side only as a reversible rollback path during this migration. The active physical-product React checkout does not call that route or present Stripe as the customer handoff.

Removing the legacy Stripe surface is a separate cleanup gate after the Shopify physical path has production proof.

## Release gates

Before calling the physical bridge live, one exact head must prove all of the following:

- TypeScript and focused Shopify contracts pass.
- The production build passes.
- Desktop and mobile Playwright prove Shop → Product → Cart → Checkout while preserving the current JBH presentation, avoiding horizontal overflow, keeping the console clean, and sending only Shopify variant GIDs plus quantities.
- A live no-payment Storefront API smoke test returns `JBH` products, finds at least one sellable variant, creates a one-line Shopify cart, and receives an HTTPS checkout URL on the canonical Shopify host without submitting an order or payment.
- The Hair Match exact-head Playwright proof stays green.
- The branch is current with `main`, review threads are clear, and merge uses expected-head protection.
- Production deployment proof is checked separately after merge before any public launch-complete claim.

## Analytics baseline

Treat Shopify sessions → cart additions → reached checkout → completed checkout as the commerce funnel. The pre-bridge baseline was zero cart additions, reached checkouts, and completed checkouts in the currently observed Shopify session window. Compare the post-deploy funnel against that baseline rather than treating a successful deploy as proof of conversion.

## Rollback

Revert the focused physical-bridge merge to restore the prior static storefront/Stripe client path. Do not alter Shopify product, inventory, fulfillment, order, or customer records during rollback. Hair Match remains independently reversible by removing its route or deactivating its Shopify product.
