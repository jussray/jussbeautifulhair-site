import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sharedCatalog = read("shared/catalog.ts");
const displayCatalog = read("client/src/lib/displayCatalog.ts");
const displayCard = read("client/src/components/DisplayProductCard.tsx");
const shop = read("client/src/pages/Shop.tsx");
const home = read("client/src/pages/Home.tsx");
const productPage = read("client/src/pages/Product.tsx");
const liveCard = read("client/src/components/ProductCard.tsx");
const catalogClient = read("client/src/lib/shopifyCatalog.ts");
const cart = read("client/src/lib/cart.tsx");

const staticIds = [...sharedCatalog.matchAll(/^\s+id: "([^"]+)"/gm)].map((match) => match[1]);

test("static catalog is the 16-product display source with a real image per product", () => {
  assert.equal(staticIds.length, 16, "expected the 16 static catalog products");
  assert.match(sharedCatalog, /const img = \(id: string\) => `\/products\/\$\{id\}\.jpg`;/);
  for (const id of staticIds) {
    assert.ok(
      existsSync(new URL(`../client/public/products/${id}.jpg`, import.meta.url)),
      `missing storefront image for static product ${id}`,
    );
  }
});

test("fallback projection maps every static product 1:1 into a display-only shape", () => {
  assert.match(displayCatalog, /import \{ FEATURED_IDS, PRODUCTS \} from "\.\/catalog";/);
  assert.match(
    displayCatalog,
    /export const DISPLAY_ONLY_PRODUCTS: DisplayOnlyProduct\[\] = PRODUCTS\.map\(toDisplayOnlyProduct\);/,
  );
  assert.match(displayCatalog, /kind: "display-only";/);
  assert.match(
    displayCatalog,
    /interface DisplayOnlyOption \{\s+option: string;\s+price: number;\s+\}/,
  );
  assert.match(
    displayCatalog,
    /options: product\.variants\.map\(\(variant\) => \(\{\s+option: variant\.option,\s+price: variant\.price,\s+\}\)\)/,
  );
});

test("fallback items carry no Shopify identity, no variant IDs, and no availability field", () => {
  for (const [name, source] of [
    ["displayCatalog", displayCatalog],
    ["DisplayProductCard", displayCard],
  ]) {
    assert.doesNotMatch(source, /gid:\/\//, `${name} must not contain Shopify GIDs`);
    assert.doesNotMatch(source, /shopifyProductId/, `${name} must not carry a Shopify product ID`);
    assert.doesNotMatch(source, /variantId/, `${name} must not carry a variant ID`);
    assert.doesNotMatch(source, /availableForSale/, `${name} must not carry availability state`);
  }
});

test("fallback items expose no cart path, no link, and no buy control", () => {
  assert.doesNotMatch(displayCard, /useCart|addItem/);
  assert.doesNotMatch(displayCard, /<Link|<button|<a\s/);
  assert.doesNotMatch(displayCard, /add to cart|checkout/i);
  assert.match(displayCard, /Browsing only — ordering is paused/);
  assert.doesNotMatch(shop, /useCart|addItem/);
  assert.doesNotMatch(home, /useCart|addItem/);
  // The cart's Shopify variant GID guard is untouched: fallback items can
  // never satisfy it, and nothing fabricates a GID for them.
  assert.match(cart, /\^gid:\\\/\\\/shopify\\\/ProductVariant\\\/\\d\+\$/);
});

test("shop renders the browsing-only collection when the live catalog fetch fails", () => {
  assert.match(shop, /data-testid="shop-catalog-fallback"/);
  assert.match(shop, /online ordering is paused/);
  assert.match(shop, /no\s+availability is promised/);
  assert.match(shop, /Online orders are temporarily paused/);
  assert.doesNotMatch(shop, /JussPay catalog/);
  assert.match(shop, /href="mailto:hello@jussbeautifulhair\.com\?subject=JBH%20Product%20Question"/);
  assert.match(shop, /data-testid="link-shop-product-inquiry"/);
  assert.match(shop, /data-testid="button-retry-catalog"/);
  assert.match(shop, /fallbackFiltered\.map\(\(product\) => \(\s+<DisplayProductCard/);
  assert.match(shop, /DISPLAY_ONLY_PRODUCTS\.filter\(\(product\) => product\.category === active\)/);

  const errorBranch = shop.indexOf("{isError && (");
  const fallbackRender = shop.indexOf("shop-catalog-fallback");
  assert.ok(errorBranch >= 0 && fallbackRender > errorBranch, "fallback must render inside the error branch");
});

test("home renders featured browsing-only items when live inventory is unverified", () => {
  assert.match(home, /data-testid="home-catalog-fallback"/);
  assert.match(home, /online ordering is paused/);
  assert.match(home, /no\s+availability is promised/);
  assert.match(home, /DISPLAY_ONLY_FEATURED\.map\(\(product\) => \(\s+<DisplayProductCard/);

  const unavailableBranch = home.indexOf('data-testid="home-catalog-unavailable"');
  const fallbackRender = home.indexOf('data-testid="home-catalog-fallback"');
  assert.ok(
    unavailableBranch >= 0 && fallbackRender > unavailableBranch,
    "home fallback must render with the catalog-unavailable state",
  );
});

test("success path is unchanged: live products still flow through the live card only", () => {
  // Live fetch contract untouched.
  assert.match(catalogClient, /fetch\("\/api\/shopify\/catalog"/);
  assert.match(catalogClient, /throw new Error\("Live inventory is temporarily unavailable\."\)/);
  assert.match(catalogClient, /staleTime:\s*30_000/);

  // Shop success grid still renders live products through ProductCard.
  assert.match(shop, /\{!isLoading && !isError && \(/);
  assert.match(shop, /filtered\.map\(\(product\) => \(\s+<ProductCard/);

  // Home live derivations still fail closed and never consume the fallback.
  assert.match(home, /const authoritativeProducts = catalogUnavailable \? \[\] : products;/);
  assert.match(
    home,
    /const availableProducts = authoritativeProducts\.filter\(\(product\) => product\.availableForSale\);/,
  );
  assert.doesNotMatch(home, /availableProducts\s*=.*DISPLAY_ONLY/);

  // The product detail page and the live card never receive display items:
  // the detail page keeps its fail-closed branch and its Add to Cart stays
  // reachable only with a verified live catalog.
  assert.doesNotMatch(productPage, /DISPLAY_ONLY|DisplayProductCard/);
  assert.doesNotMatch(liveCard, /DISPLAY_ONLY|DisplayOnlyProduct/);
  assert.match(productPage, /data-testid="product-catalog-unavailable"/);
});
