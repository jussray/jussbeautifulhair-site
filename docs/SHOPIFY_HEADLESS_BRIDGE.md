# Shopify Headless Bridge Offer

## Purpose

Use the existing Juss Beautiful Hair React/Vite storefront as the public experience while Shopify owns the bridge-offer product, Storefront Cart API, checkout, payment, and order creation.

## Public configuration

Configure these build-time variables only after the Shopify Headless storefront is created:

```dotenv
VITE_SHOPIFY_STORE_DOMAIN=jbh-25.myshopify.com
VITE_SHOPIFY_STOREFRONT_ACCESS=<public Storefront API access value>
VITE_SHOPIFY_STOREFRONT_API_VERSION=2026-07
VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID=gid://shopify/ProductVariant/50196622344435
```

`VITE_SHOPIFY_STOREFRONT_ACCESS` must contain only the public browser-safe Storefront access value issued for this storefront. Never use an Admin API token, private Storefront token, app secret, Shopify account password, or customer data in a `VITE_` variable.

## Runtime flow

1. Customer opens `/#/hair-match`.
2. The customer optionally refines four bounded, non-sensitive preferences: product goal, length range, future-order budget band, and maintenance preference. “Not sure yet” remains valid.
3. The page calls Shopify Storefront API `cartCreate` with the approved Hair Match variant and those preferences as cart attributes.
4. Shopify returns the canonical total and `checkoutUrl`.
5. The browser redirects to Shopify Web Checkout.
6. Shopify owns payment, tax, checkout identity, and order creation.
7. Private paid-service ingestion belongs in `jbh-private`; a Hair Match consultation must stay excluded from vendor routing.

## Preference boundary

Only these cart attributes are allowed:

- `hair_goal`
- `preferred_length`
- `budget`
- `maintenance`

The client also binds `source=jussbeautifulhair.com` and `offer=jbh-hair-match-v1`. Values are enumerated in the UI and truncated before transmission. Do not collect sensitive traits, medical information, free-form private notes, addresses, or payment data through these attributes.

## Activation gates

Do not publish the product or advertise the route until all are true:

- Shopify store is upgraded from trial and checkout is available.
- Hair Match product is active and published to the Headless sales channel.
- Public Storefront API access and permissions are configured.
- Desktop and mobile Playwright verification passes on the exact branch head.
- A real test checkout proves the correct product, price, disclosure, preference attributes, and Shopify checkout domain.
- Paid-order webhook delivery to `jbh-private` is verified without exposing vendor or customer data publicly.
- The paid consultation is recorded as a service with vendor routing marked not applicable.

## MCP boundary

Storefront MCP may later power an Ask Juss shopping assistant for catalog search, product lookup, policy answers, and cart help. Standard customer browsing and checkout should continue to use Storefront API and Shopify Web Checkout. The owner Shopify connector used by ChatGPT is not exposed to public customers.

## Rollback

Remove the `/hair-match` route and its environment variables. The Shopify product can remain draft or be archived. Existing Stripe checkout remains unchanged until a separately verified migration replaces it for the full catalog.
