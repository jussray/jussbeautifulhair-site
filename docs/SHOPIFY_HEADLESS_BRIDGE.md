# Shopify Checkout Bridge Offer

## Purpose

Use the existing Juss Beautiful Hair React/Vite storefront as the public experience while Shopify owns the Hair Match product, checkout, payment, tax, and order creation.

For this fixed one-product offer, use Shopify's tokenless cart permalink instead of adding a Headless channel, Storefront API token, custom checkout server, or deployment-secret dependency.

## Approved public contract

The storefront intentionally code-locks these public Shopify identifiers:

```text
shop domain: 8qp1z2-az.myshopify.com
variant GID: gid://shopify/ProductVariant/50196622344435
offer code: jbh-hair-match-v1
quantity: 1
price shown: $25.00
```

No build variable is required for the approved Hair Match checkout. Changing the shop, variant, quantity, offer code, or displayed price requires a reviewed code change and exact-head proof.

Never place an Admin API token, Storefront access token, app secret, Shopify account password, webhook secret, or customer data in browser code or a `VITE_` variable.

## Runtime flow

1. Customer opens `/#/hair-match`.
2. The customer chooses four bounded, non-sensitive preferences: product goal, length range, future-order budget band, and maintenance preference. “Not sure yet” remains valid.
3. The page validates that all four unique preference keys are present and truncates each value to 120 characters.
4. The page builds an HTTPS Shopify cart permalink for the approved numeric variant and quantity `1`.
5. Preferences are attached as `attributes[...]` query parameters with `source=jussbeautifulhair.com`, `offer=jbh-hair-match-v1`, and the same offer code in `ref`.
6. The browser redirects directly to Shopify checkout.
7. Shopify owns payment, tax, checkout identity, and order creation.
8. Until private webhook automation is separately proven, Shopify Admin remains the authoritative order record and the first consultations are handled manually.

## Product contract

Provider state verified during activation:

- Product: `Juss Hair Match Session + $25 Purchase Credit`
- Product GID: `gid://shopify/Product/9696750010611`
- Variant: `gid://shopify/ProductVariant/50196622344435`
- Price: `$25.00`
- Status: `ACTIVE`
- Online Store publication: published
- Available for sale: true
- Inventory tracking: disabled
- Requires shipping: false

Repository proof does not replace a live no-payment checkout smoke test. Shopify provider state can change independently and must be re-read before making a new production claim.

## Preference boundary

Only these cart attributes are allowed:

- `hair_goal`
- `preferred_length`
- `budget`
- `maintenance`

Duplicate, missing, unknown, or empty preference keys fail closed. Do not collect sensitive traits, medical information, free-form private notes, addresses, payment data, or supplier information through these attributes.

## Release gates

Before calling the custom storefront path live, require all of the following on one exact head:

- TypeScript and focused checkout contracts pass.
- Production build passes.
- Desktop and mobile Playwright prove the route, truthful disclosure, enabled CTA, approved variant, quantity, attributes, HTTPS Shopify permalink, no token exposure, no overflow, and clean console.
- The branch is current with `main` and has zero unresolved critical review threads.
- The merge uses expected-head protection.
- Cloudflare deploys the merged commit successfully.
- A live no-payment smoke test reaches the correct Shopify cart or checkout and confirms the $25 non-shipping service without completing a purchase.

A storefront password, unavailable product, changed variant, changed price, or provider redirect mismatch blocks the live claim even when repository checks pass.

## Private automation boundary

Private Shopify paid-service ingestion belongs in `jbh-private`. It must keep Hair Match separate from physical-product orders and mark vendor routing not applicable.

That automation is not a first-sale blocker because Shopify Admin can remain the authoritative paid-order record for the first manually serviced consultations. Do not claim automated private ingestion until its migration, secrets, endpoint, webhook registration, exact-head tests, duplicate proof, database evidence, and rollback have all been verified.

## MCP boundary

Storefront MCP may later power an Ask Juss shopping assistant for catalog search, product lookup, policy answers, and cart help. It is unnecessary for this fixed one-product checkout. The owner Shopify connector used by ChatGPT is never exposed to public customers.

## Rollback

Remove the `/hair-match` route and navigation, or deactivate/unpublish the Shopify product. Preserve any existing Shopify order and customer records. The older physical catalog and Stripe checkout remain unchanged until a separately verified migration replaces them.
