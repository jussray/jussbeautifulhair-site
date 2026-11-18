import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  SHOPIFY_PRIMARY_HOST,
  SHOPIFY_PROXY_HOST,
  SHOPIFY_PROXY_ORIGIN,
  SHOPIFY_PROXY_PATH_PREFIXES,
  isShopifyProxyPath,
  proxyToShopify,
  rewriteProxyRedirectLocation,
} from "../worker/shopifyProxy.mjs";

test("proxy target is the fixed Shopify origin, never caller-controlled", () => {
  assert.equal(SHOPIFY_PROXY_HOST, "8qp1z2-az.myshopify.com");
  assert.equal(SHOPIFY_PRIMARY_HOST, "www.jussbeautifulhair.com");
  assert.equal(SHOPIFY_PROXY_ORIGIN, "https://8qp1z2-az.myshopify.com");
  assert.ok(Object.isFrozen(SHOPIFY_PROXY_PATH_PREFIXES));
});

test("Shopify-owned checkout paths proxy; SPA routes do not", () => {
  // The exact break from the 2026-10-11 checkout walk: /cart/c/<token> on the
  // branded domain rendered the SPA shell (blank) and the SPA handoff looped.
  assert.ok(isShopifyProxyPath("/cart/c/hWNHrOH3pwCPf9nXQnQYvKp6"));
  assert.ok(isShopifyProxyPath("/checkouts/cn/hWNHrOH3pwCPf9nXQnQYvKp6"));
  assert.ok(isShopifyProxyPath("/wallets/checkouts.json"));

  // SPA-owned routes must keep serving the storefront, never Shopify.
  for (const spaRoute of [
    "/",
    "/cart",
    "/cart/",
    "/checkout",
    "/shop",
    "/hair-match",
    "/api/shopify/cart",
  ]) {
    assert.equal(isShopifyProxyPath(spaRoute), false, `${spaRoute} must not proxy`);
  }

  // Non-string / non-absolute input fails closed.
  assert.equal(isShopifyProxyPath(""), false);
  assert.equal(isShopifyProxyPath("cart/c/x"), false);
  assert.equal(isShopifyProxyPath(null), false);
  assert.equal(isShopifyProxyPath(undefined), false);
});

test("Shopify-origin redirects are rewritten to the branded host", () => {
  assert.equal(
    rewriteProxyRedirectLocation(
      "https://8qp1z2-az.myshopify.com/cart/c/abc123?key=k",
      "https://jussbeautifulhair.com",
    ),
    "https://jussbeautifulhair.com/cart/c/abc123?key=k",
  );
  // Host comparison is case-insensitive.
  assert.equal(
    rewriteProxyRedirectLocation(
      "https://8QP1Z2-AZ.MYSHOPIFY.COM/checkouts/cn/x",
      "https://jussbeautifulhair.com",
    ),
    "https://jussbeautifulhair.com/checkouts/cn/x",
  );
  // Local dev: protocol, host, and port all follow the request origin.
  assert.equal(
    rewriteProxyRedirectLocation(
      "https://8qp1z2-az.myshopify.com/cart/c/x",
      "http://localhost:8787",
    ),
    "http://localhost:8787/cart/c/x",
  );
});

test("non-Shopify redirects pass through untouched", () => {
  assert.equal(
    rewriteProxyRedirectLocation("https://shop.app/pay/x", "https://jussbeautifulhair.com"),
    "https://shop.app/pay/x",
  );
  assert.equal(
    rewriteProxyRedirectLocation("https://jussbeautifulhair.com/shop", "https://jussbeautifulhair.com"),
    "https://jussbeautifulhair.com/shop",
  );
  // Relative locations already resolve against the branded host.
  assert.equal(
    rewriteProxyRedirectLocation("/checkouts/cn/x", "https://jussbeautifulhair.com"),
    "/checkouts/cn/x",
  );
});

test("unparseable input fails closed to the original value", () => {
  assert.equal(rewriteProxyRedirectLocation("https://[::1", "https://jussbeautifulhair.com"), "https://[::1");
  assert.equal(rewriteProxyRedirectLocation("", "https://jussbeautifulhair.com"), "");
  assert.equal(rewriteProxyRedirectLocation(null, "https://jussbeautifulhair.com"), null);
  assert.equal(
    rewriteProxyRedirectLocation("https://8qp1z2-az.myshopify.com/x", ""),
    "https://8qp1z2-az.myshopify.com/x",
  );
});

test("proxyToShopify targets the Shopify origin with the branded Host header", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input);
    seen.push({
      url: req.url,
      method: req.method,
      host: req.headers.get("host"),
      redirect: req.redirect,
    });
    return new Response("<html>checkout</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  try {
    const res = await proxyToShopify(
      new Request("https://jussbeautifulhair.com/cart/c/abc123?key=k1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "x" }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<html>checkout</html>");
    assert.equal(seen.length, 1);
    // Fixed origin + original path/query: never caller-controlled.
    assert.equal(
      seen[0].url,
      "https://8qp1z2-az.myshopify.com/cart/c/abc123?key=k1",
    );
    // Loop-break: Shopify sees the branded Host, so it serves 200 instead of
    // 301-canonicalizing back to the primary domain.
    assert.equal(seen[0].host, "www.jussbeautifulhair.com");
    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].redirect, "manual");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("worker entry routes Shopify-owned paths to the proxy before the SPA fallback", async () => {
  const entry = await readFile(new URL("../worker/entry.ts", import.meta.url), "utf8");
  const branchIndex = entry.indexOf("if (isShopifyProxyPath(pathname))");
  assert.notEqual(branchIndex, -1, "proxy branch missing from worker entry");
  const fallbackIndex = entry.indexOf("await worker.fetch(request, env)");
  assert.notEqual(fallbackIndex, -1, "SPA fallback delegation missing from worker entry");
  assert.ok(
    branchIndex < fallbackIndex,
    "proxy branch must run before the SPA fallback delegation",
  );
  assert.match(entry, /return proxyToShopify\(request\)/);
});

test("proxyToShopify rewrites Shopify-origin redirects to the branded host", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, {
      status: 301,
      headers: { location: "https://8qp1z2-az.myshopify.com/checkouts/cn/abc" },
    });
  try {
    const res = await proxyToShopify(
      new Request("https://jussbeautifulhair.com/cart/c/abc123?key=k1"),
    );
    assert.equal(res.status, 301);
    assert.equal(
      res.headers.get("location"),
      "https://jussbeautifulhair.com/checkouts/cn/abc",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});


test("apex and www checkout requests both use Shopify's verified primary Host", async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (request) => {
    seen.push({ host: request.headers.get("host"), url: request.url });
    return new Response("checkout", { status: 200 });
  };
  try {
    for (const host of ["jussbeautifulhair.com", "www.jussbeautifulhair.com"]) {
      const result = await proxyToShopify(new Request(`https://${host}/cart/c/test-token`));
      assert.equal(result.status, 200);
    }
    assert.deepEqual(seen.map((item) => item.host), [SHOPIFY_PRIMARY_HOST, SHOPIFY_PRIMARY_HOST]);
    assert.ok(seen.every((item) => item.url === "https://8qp1z2-az.myshopify.com/cart/c/test-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
