import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

const shopDomain = "8qp1z2-az.myshopify.com";
const checkoutHosts = new Set(["jussbeautifulhair.com", shopDomain]);
const apiVersion = "2026-07";
const endpoint = `https://${shopDomain}/api/${apiVersion}/graphql.json`;
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/shopify-physical-live";

const catalogQuery = `
  query JbhLiveCatalogSmoke($first: Int!, $query: String!) {
    products(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        vendor
        availableForSale
        variants(first: 10) {
          nodes {
            id
            title
            availableForSale
            price { amount currencyCode }
          }
        }
      }
    }
  }
`;

const cartMutation = `
  mutation JbhLiveCartSmoke($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors { field message code }
      warnings { message code }
    }
  }
`;

async function storefrontRequest(query, variables) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({}));
  const errorSummary = JSON.stringify(payload.errors ?? payload).slice(0, 500);
  assert.equal(
    response.ok,
    true,
    `Storefront API returned HTTP ${response.status}: ${errorSummary}`,
  );
  assert.equal(
    Array.isArray(payload.errors) && payload.errors.length > 0,
    false,
    `Storefront API returned GraphQL errors: ${errorSummary}`,
  );
  assert.ok(payload.data, `Storefront API response is missing data: ${errorSummary}`);
  return payload.data;
}

await mkdir(outputDir, { recursive: true });

const catalog = await storefrontRequest(catalogQuery, {
  first: 10,
  query: "vendor:JBH",
});

const supplierProducts = catalog.products.nodes.filter((product) => product.vendor === "JBH");
assert.ok(supplierProducts.length > 0, "No JBH supplier-backed products were visible through the Storefront API");

const product = supplierProducts.find(
  (candidate) =>
    candidate.availableForSale &&
    candidate.variants.nodes.some((variant) => variant.availableForSale),
);
assert.ok(product, "No sellable JBH product variant was visible through the Storefront API");

const variant = product.variants.nodes.find((candidate) => candidate.availableForSale);
assert.ok(variant, "No available variant was found for the live Shopify cart smoke test");
assert.match(variant.id, /^gid:\/\/shopify\/ProductVariant\/\d+$/);

const created = await storefrontRequest(cartMutation, {
  input: {
    lines: [{ merchandiseId: variant.id, quantity: 1 }],
    attributes: [
      { key: "source", value: "github-exact-head-smoke" },
      { key: "bridge", value: "cloudflare-shopify-v1" },
    ],
  },
});

const cartDiagnostics = JSON.stringify({
  selectedProductHandle: product.handle,
  selectedVariantId: variant.id,
  selectedVariantTitle: variant.title,
  selectedVariantPrice: variant.price,
  userErrors: created.cartCreate.userErrors,
  warnings: created.cartCreate.warnings,
  totalQuantity: created.cartCreate.cart?.totalQuantity ?? null,
});
console.log(`Live Shopify cart diagnostics: ${cartDiagnostics}`);

assert.equal(
  created.cartCreate.userErrors.length,
  0,
  `Shopify rejected the no-payment cart smoke test: ${cartDiagnostics}`,
);
assert.ok(created.cartCreate.cart, `Shopify did not return a cart: ${cartDiagnostics}`);
assert.equal(
  created.cartCreate.cart.totalQuantity,
  1,
  `Unexpected cart quantity: ${cartDiagnostics}`,
);

const checkout = new URL(created.cartCreate.cart.checkoutUrl);
assert.equal(checkout.protocol, "https:", "Shopify checkout must use HTTPS");
assert.equal(
  checkoutHosts.has(checkout.hostname.toLowerCase()),
  true,
  "Shopify checkout returned an unexpected host",
);
assert.equal(checkout.username, "", "Shopify checkout URL must not contain credentials");
assert.equal(checkout.password, "", "Shopify checkout URL must not contain credentials");
assert.equal(checkout.port, "", "Shopify checkout URL must not use a custom port");

await writeFile(
  `${outputDir}/manifest.json`,
  `${JSON.stringify(
    {
      expectedHead,
      verifiedAt: new Date().toISOString(),
      shopDomain,
      apiVersion,
      supplierProductCount: supplierProducts.length,
      selectedProductHandle: product.handle,
      selectedVariantId: variant.id,
      checkoutHost: checkout.hostname,
      checkoutPathPrefix: checkout.pathname.split("/").slice(0, 3).join("/"),
      assertions: [
        "bounded tokenless Storefront catalog returned JBH vendor products",
        "at least one supplier-backed variant was available for sale",
        "Shopify created a one-line no-payment cart",
        "checkout URL was HTTPS and stayed on an exact approved JBH/Shopify host",
        "no order or payment was submitted",
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(`Live Shopify physical-cart smoke passed for ${expectedHead}.`);
