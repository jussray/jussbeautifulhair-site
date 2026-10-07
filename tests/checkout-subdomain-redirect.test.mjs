import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// Behavior contract for the Shopify primary-domain move to checkout.jussbeautifulhair.com.
// Once Shopify's primary domain is the checkout subdomain, Cart checkoutUrl comes back on
// that host. The client guard must accept it and must NOT rewrite it (it is served by
// Shopify, not the Cloudflare SPA). The apex host still collides with the SPA and keeps
// its rewrite to the canonical shop domain.
async function loadGuard() {
  const source = await readFile(
    path.join(process.cwd(), "client", "src", "lib", "shopifyCatalog.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  const standalone = outputText.replace(
    /^import\s*\{\s*useQuery\s*\}\s*from\s*["']@tanstack\/react-query["'];?/m,
    "const useQuery = () => { throw new Error('react-query unavailable in guard test'); };",
  );
  const encoded = Buffer.from(standalone, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("checkout subdomain URL is approved and preserved exactly", async () => {
  const { assertApprovedShopifyCheckoutRedirect } = await loadGuard();
  const url = "https://checkout.jussbeautifulhair.com/cart/c/abc123?key=k1";
  assert.equal(assertApprovedShopifyCheckoutRedirect(url), url);
});

test("apex storefront host is still escaped to the canonical shop domain", async () => {
  const { assertApprovedShopifyCheckoutRedirect } = await loadGuard();
  assert.equal(
    assertApprovedShopifyCheckoutRedirect("https://jussbeautifulhair.com/cart/c/abc123?key=k1"),
    "https://8qp1z2-az.myshopify.com/cart/c/abc123?key=k1",
  );
});

test("lookalike and unapproved hosts stay blocked", async () => {
  const { assertApprovedShopifyCheckoutRedirect } = await loadGuard();
  for (const bad of [
    "https://checkout.jussbeautifulhair.com.evil.example/cart/c/x",
    "https://evilcheckout.jussbeautifulhair.com/cart/c/x",
    "http://checkout.jussbeautifulhair.com/cart/c/x",
    "https://checkout.jussbeautifulhair.com:8443/cart/c/x",
  ]) {
    assert.throws(() => assertApprovedShopifyCheckoutRedirect(bad), /not approved/, bad);
  }
});
