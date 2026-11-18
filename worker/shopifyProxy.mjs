/**
 * Branded Shopify checkout proxy contract.
 *
 * Shopify canonicalizes cart/checkout URLs to the store's primary domain
 * (jussbeautifulhair.com). That host is served by the Cloudflare SPA, which has
 * no route that can render Shopify-owned checkout content — the SPA-side
 * handoff (ShopifyCartHandoff -> myshopify.com -> 301 back to the branded
 * domain -> SPA handoff ...) loops forever and the customer sees a blank page
 * at the payment step (verified live 2026-10-11).
 *
 * These helpers decide which request paths the Worker reverse-proxies to the
 * Shopify origin, and keep Shopify's own redirects on the branded host so the
 * customer never leaves jussbeautifulhair.com mid-checkout.
 */

// Canonical Shopify origin for this store. Fixed target: this module is never
// an open proxy — only the paths below are forwarded, and only here.
export const SHOPIFY_PROXY_HOST = "8qp1z2-az.myshopify.com";
export const SHOPIFY_PROXY_ORIGIN = `https://${SHOPIFY_PROXY_HOST}`;
// Verified Shopify Admin primary domain (2026-10-27). Keep upstream Host canonical.
export const SHOPIFY_PRIMARY_HOST = "www.jussbeautifulhair.com";

// Exact "/cart" stays with the SPA cart page; only Shopify-owned subpaths
// proxy. "/checkouts/*" covers checkout-completion redirects, "/wallets/*"
// covers accelerated payment handoffs (Shop Pay etc.).
export const SHOPIFY_PROXY_PATH_PREFIXES = Object.freeze([
  "/cart/c/",
  "/checkouts/",
  "/wallets/",
]);

export function isShopifyProxyPath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  return SHOPIFY_PROXY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Keep the customer on the branded host when Shopify redirects to its own
 * origin (primary-domain canonicalization). Returns the rewritten Location,
 * or the original value when it is not a Shopify-origin redirect or either
 * input cannot be parsed (fail closed: never invent a redirect target).
 */
export function rewriteProxyRedirectLocation(location, requestOrigin) {
  if (typeof location !== "string" || !location) return location;
  if (typeof requestOrigin !== "string" || !requestOrigin) return location;
  let origin;
  try {
    origin = new URL(requestOrigin);
  } catch {
    return location;
  }
  let target;
  try {
    // Relative locations already resolve against the branded host.
    target = new URL(location, origin);
  } catch {
    return location;
  }
  if (target.hostname.toLowerCase() !== SHOPIFY_PROXY_HOST) return location;
  target.protocol = origin.protocol;
  target.hostname = origin.hostname;
  target.port = origin.port;
  return target.toString();
}

/**
 * Reverse-proxy a Shopify-owned checkout request to the Shopify origin.
 *
 * Loop-break: Shopify 301-redirects myshopify-host requests to the store's
 * primary (custom) domain, which would bounce forever between the proxy and
 * the origin. Sending the branded Host header makes Shopify serve the
 * checkout directly instead of canonicalizing. Use the Shopify-configured
 * primary hostname even for requests arriving on the apex domain.
 */
export async function proxyToShopify(request) {
  const requestUrl = new URL(request.url);
  const target = new URL(SHOPIFY_PROXY_ORIGIN);
  target.pathname = requestUrl.pathname;
  target.search = requestUrl.search;

  const headers = new Headers(request.headers);
  headers.set("host", SHOPIFY_PRIMARY_HOST);

  // Node's undici requires `duplex: "half"` for streaming request bodies;
  // the Workers runtime ignores the unknown init key.
  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(new Request(target.toString(), init));

  const responseHeaders = new Headers(upstream.headers);
  const location = responseHeaders.get("location");
  if (location) {
    responseHeaders.set(
      "location",
      rewriteProxyRedirectLocation(location, requestUrl.origin),
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
