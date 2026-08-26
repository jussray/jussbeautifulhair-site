import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../client/src/pages/Product.tsx", import.meta.url),
  "utf8",
);

test("Product fails closed when a Shopify background catalog refetch fails", () => {
  assert.match(source, /\bisRefetchError\b/);
  assert.match(
    source,
    /const catalogUnavailable = isError \|\| isRefetchError;/,
  );
  assert.match(source, /if \(catalogUnavailable\) \{/);
  assert.match(source, /data-testid="product-catalog-unavailable"/);
  assert.match(source, /data-testid="button-product-catalog-retry"/);
  assert.match(source, /We are not showing stale pricing or availability\./);

  const unavailableBranch = source.indexOf("if (catalogUnavailable)");
  const variantDerivation = source.indexOf("const variant =");
  const addToCartHandler = source.indexOf("const add =");

  assert.ok(unavailableBranch >= 0, "catalog-unavailable branch must exist");
  assert.ok(
    variantDerivation > unavailableBranch,
    "variant/price authority must be derived only after the fail-closed branch",
  );
  assert.ok(
    addToCartHandler > unavailableBranch,
    "Add-to-Cart authority must be unreachable while catalog truth is unavailable",
  );
});
