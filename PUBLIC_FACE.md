# Juss Beautiful Hair

Juss Beautiful Hair is a premium hair and beauty storefront for raw Vietnamese and Indian temple hair, HD lace closures, frontals, wigs, and beauty essentials.

## Public storefront truth

Canonical branded storefront:

https://jussbeautifulhair.com

The public React/Vite storefront is delivered through Cloudflare. Shopify remains the commerce source of truth for sellable catalog state, current pricing, availability, cart creation, discounts, shipping, taxes, payment, and order creation.

The storefront must not copy Shopify into a second sellable catalog, invent stock, or imply checkout state from stale client data.

## What customers can do

- Browse the current hair and beauty storefront.
- Read product details and current availability surfaced from the approved commerce path.
- Use the Hair Match experience where available.
- Create a cart through the governed Shopify bridge.
- Continue to Shopify-hosted checkout for final commerce state and payment.

## Public truth boundary

A product page may describe real catalog data returned through the approved storefront path. Final sellability, discounts, shipping, taxes, payment, and order creation remain Shopify-owned state.

The private repository `jussray/jbh-private` is a separate vendor/admin authority and must not be exposed as public storefront content.

## Public CTA

Shop the canonical storefront:

https://jussbeautifulhair.com

Canonical public storefront source:

https://github.com/jussray/jussbeautifulhair-site
