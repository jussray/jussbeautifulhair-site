# Shopify Checkout Bridge Offer

## Purpose

Use the existing Juss Beautiful Hair React/Vite storefront as the public experience while Shopify owns the bridge-offer product, checkout, payment, and order creation.

For this fixed one-product offer, use Shopify's tokenless cart permalink instead of adding a Headless channel and Storefront API token. This removes an unnecessary credential and keeps checkout authority with Shopify.

## Public configuration

```dotenv
VITE_SHOPIFY_STORE_DOMAIN=jbh-25.myshopify.com
VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID=gid://shopify/ProductVariant/50196622344435
```

Both values are public identifiers. Never place an Admin API token, Storefront access token, app secret, Shopify account password, or customer data in a `VITE_` variable.

## Runtime flow

1. Customer opens `/#/hair-match`.
2. The customer optionally refines four bounded, non-sensitive preferences: product goal, length range, future-order budget band, and maintenance preference. “Not sure yet” remains valid.
3. The page builds an HTTPS Shopify cart permalink for the approved numeric variant and quantity `1`.
4. The preferences are attached as `attributes[...]` query parameters, with `source=jussbeautifulhair.com`, `offer=jbh-hair-match-v1`, and the same value in `ref`.
5. The browser redirects directly to Shopify checkout.
6. Shopify owns payment, tax, checkout identity, and order creation.
7. Private paid-service ingestion belongs in `jbh-private`; a Hair Match consultation must stay excluded from vendor routing.

## Product contract

- Product: `Juss Hair Match Session + $25 Purchase Credit`
- Variant: `gid://shopify/ProductVariant/50196622344435`
- Price: `$25.00`
- Inventory tracking: disabled
- Requires shipping: false
- Status until activation: `DRAFT`

## Preference boundary

Only these cart attributes are allowed:

- `hair_goal`
- `preferred_length`
- `budget`
- `maintenance`

Values are enumerated in the UI and truncated before transmission. Do not collect sensitive traits, medical information, free-form private notes, addresses, or payment data through these attributes.

## Activation gates

Do not publish the product or advertise the route until all are true:

- The Shopify store remains on a checkout-capable paid plan.
- The Hair Match product is active and published to the Online Store channel.
- The Shopify storefront password does not block the cart permalink, or a real test proves the approved checkout path works despite the current configuration.
- Production receives only the public store-domain and variant-ID variables.
- Desktop and mobile Playwright verification passes on the exact branch head.
- A real safe checkout proves the correct product, $25 price, no-shipping behavior, disclosure, preference attributes, and Shopify checkout domain.
- Paid-order webhook delivery to `jbh-private` is verified without exposing vendor or customer data publicly.
- The paid consultation is recorded as a service with vendor routing marked not applicable.

## MCP boundary

Storefront MCP may later power an Ask Juss shopping assistant for catalog search, product lookup, policy answers, and cart help. It is unnecessary for this fixed one-product checkout. The owner Shopify connector used by ChatGPT is never exposed to public customers.

## Rollback

Remove the `/hair-match` route and its two public environment variables. The Shopify product can remain draft or be archived. Existing Stripe checkout remains unchanged until a separately verified migration replaces it for the full catalog.
