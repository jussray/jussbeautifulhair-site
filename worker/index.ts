import Stripe from "stripe";
import { z } from "zod";
import { getProduct } from "../shared/catalog";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetBinding;
  STRIPE_SECRET_KEY: string;
  STORE_ORIGIN?: string;
  ALLOWED_STOREFRONT_ORIGINS?: string;
  CONTACT_API_ORIGIN?: string;
  RELEASE_SHA?: string;
  GITHUB_SHA?: string;
  WORKERS_CI_COMMIT_SHA?: string;
}

const FREE_SHIPPING_THRESHOLD = 150;
const FLAT_SHIPPING = 9.99;
const MAX_BODY_BYTES = 64 * 1024;
const CHECKOUT_SESSION_ROUTE_PREFIX = "/api/checkout/session/";

const SHOPIFY_STOREFRONT = Object.freeze({
  shopDomain: "8qp1z2-az.myshopify.com",
  apiVersion: "2026-07",
  vendor: "JBH",
  catalogPageSize: 25,
});
const SHOPIFY_STOREFRONT_ENDPOINT = `https://${SHOPIFY_STOREFRONT.shopDomain}/api/${SHOPIFY_STOREFRONT.apiVersion}/graphql.json`;

const SHOPIFY_CATALOG_QUERY = `
  query JbhVendorCatalog($first: Int!, $query: String!) {
    products(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        description
        productType
        vendor
        availableForSale
        featuredImage {
          url
          altText
        }
        variants(first: 20) {
          nodes {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SHOPIFY_VARIANT_PREFLIGHT_QUERY = `
  query JbhCartVariantPreflight($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        availableForSale
        product {
          id
          handle
          vendor
          availableForSale
        }
      }
    }
  }
`;

const SHOPIFY_CART_CREATE_MUTATION = `
  mutation JbhCreateCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
        code
      }
      warnings {
        message
        code
      }
    }
  }
`;

const checkoutSchema = z.object({
  checkoutAttemptId: z.string().uuid(),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        variant: z.string().trim().min(1).max(100),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
});

const shopifyCartSchema = z.object({
  lines: z
    .array(
      z.object({
        merchandiseId: z
          .string()
          .trim()
          .regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
});

const checkoutSessionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^cs_(?:test_|live_)?[A-Za-z0-9]+$/);

function json(body: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function getAllowedOrigins(env: Env): string[] {
  const raw =
    env.ALLOWED_STOREFRONT_ORIGINS ||
    env.STORE_ORIGIN ||
    "https://jussbeautifulhair.com";

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}

function getContactApiOrigin(env: Env): string | undefined {
  if (!env.CONTACT_API_ORIGIN) return undefined;

  try {
    const url = new URL(env.CONTACT_API_ORIGIN);
    if (url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function getReleaseSha(env: Env): string {
  return (
    [env.RELEASE_SHA, env.GITHUB_SHA, env.WORKERS_CI_COMMIT_SHA]
      .map((value) => value?.trim())
      .find(Boolean) || "unknown"
  );
}

function createStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

function isApprovedRequestHost(request: Request, env: Env): boolean {
  const requestHostname = new URL(request.url).hostname.toLowerCase();

  if (requestHostname === "localhost" || requestHostname === "127.0.0.1") {
    return true;
  }

  const approvedHosts = new Set(
    getAllowedOrigins(env).map((origin) => new URL(origin).hostname.toLowerCase()),
  );

  return approvedHosts.has(requestHostname);
}

function rejectedHostResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function secureAssetResponse(response: Response, env: Env): Response {
  const secured = new Response(response.body, response);
  const contactApiOrigin = getContactApiOrigin(env);
  const connectSources = [
    "'self'",
    "https://challenges.cloudflare.com",
    ...(contactApiOrigin ? [contactApiOrigin] : []),
  ].join(" ");

  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  secured.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "script-src 'self' https://challenges.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; " +
      `connect-src ${connectSources}; frame-src https://challenges.cloudflare.com; ` +
      "form-action 'self' https://checkout.stripe.com; upgrade-insecure-requests",
  );
  secured.headers.set("Content-Signal", "ai-train=no, search=yes, ai-input=no");
  return secured;
}

async function parseBoundedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  return JSON.parse(raw);
}

type ShopifyGraphqlPayload<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

async function shopifyStorefrontRequest<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(SHOPIFY_STOREFRONT_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json().catch(() => ({}))) as ShopifyGraphqlPayload<T>;
  if (!response.ok || payload.errors?.length || !payload.data) {
    console.error(`[SHOPIFY] Storefront request failed - status=${response.status}`);
    throw new Error("SHOPIFY_STOREFRONT_UNAVAILABLE");
  }

  return payload.data;
}

function inferShopifyCategory(productType: string, title: string): string {
  const normalized = `${productType} ${title}`.toLowerCase();
  if (normalized.includes("wig")) return "Wigs";
  if (normalized.includes("closure") || normalized.includes("frontal")) {
    return "Closures & Frontals";
  }
  if (normalized.includes("bundle") || normalized.includes("weft")) return "Bundles";
  return "Beauty Essentials";
}

type ShopifyCatalogData = {
  products: {
    nodes: Array<{
      id: string;
      handle: string;
      title: string;
      description: string;
      productType: string;
      vendor: string;
      availableForSale: boolean;
      featuredImage: { url: string; altText?: string | null } | null;
      variants: {
        nodes: Array<{
          id: string;
          title: string;
          availableForSale: boolean;
          price: { amount: string; currencyCode: string };
        }>;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

async function handleShopifyCatalog(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  try {
    const data = await shopifyStorefrontRequest<ShopifyCatalogData>(SHOPIFY_CATALOG_QUERY, {
      first: SHOPIFY_STOREFRONT.catalogPageSize,
      query: `vendor:${SHOPIFY_STOREFRONT.vendor}`,
    });

    if (data.products.pageInfo.hasNextPage) {
      console.error("[SHOPIFY] Catalog page limit reached; refusing partial catalog response");
      throw new Error("SHOPIFY_CATALOG_PAGE_LIMIT");
    }

    const products = data.products.nodes
      .filter((product) => product.vendor === SHOPIFY_STOREFRONT.vendor)
      .map((product) => {
        const variants = product.variants.nodes
          .map((variant) => ({
            id: variant.id,
            option: variant.title,
            price: Number(variant.price.amount),
            availableForSale: variant.availableForSale,
          }))
          .filter(
            (variant) =>
              /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant.id) &&
              Number.isFinite(variant.price) &&
              variant.price > 0,
          );

        return {
          id: product.handle,
          shopifyProductId: product.id,
          name: product.title,
          category: inferShopifyCategory(product.productType, product.title),
          tagline: "",
          description: product.description,
          variants,
          image: product.featuredImage?.url || "",
          availableForSale:
            product.availableForSale && variants.some((variant) => variant.availableForSale),
        };
      })
      .filter((product) => product.variants.length > 0);

    return json({ products, source: "shopify-storefront" });
  } catch {
    return json({ error: "Live inventory is temporarily unavailable" }, 502);
  }
}

type ShopifyVariantPreflightData = {
  nodes: Array<
    | {
        id: string;
        availableForSale: boolean;
        product: {
          id: string;
          handle: string;
          vendor: string;
          availableForSale: boolean;
        };
      }
    | null
  >;
};

type ShopifyCartCreateData = {
  cartCreate: {
    cart: {
      id: string;
      checkoutUrl: string;
      totalQuantity: number;
      cost: {
        subtotalAmount: { amount: string; currencyCode: string };
        totalAmount: { amount: string; currencyCode: string };
      };
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string; code?: string | null }>;
    warnings: Array<{ message: string; code?: string | null }>;
  };
};

function assertApprovedShopifyCheckoutUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("INVALID_SHOPIFY_CHECKOUT_URL");
  }

  const checkout = new URL(rawUrl.trim());
  if (
    checkout.protocol !== "https:" ||
    checkout.hostname !== SHOPIFY_STOREFRONT.shopDomain ||
    checkout.username ||
    checkout.password ||
    checkout.port
  ) {
    throw new Error("INVALID_SHOPIFY_CHECKOUT_URL");
  }
  return checkout.toString();
}

async function handleShopifyCart(request: Request, env: Env): Promise<Response> {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = request.headers.get("Origin");

  if (!origin || !allowedOrigins.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = await parseBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return json({ error: "Request too large" }, 413, origin);
    }
    return json({ error: "Invalid request" }, 400, origin);
  }

  const parsed = shopifyCartSchema.safeParse(parsedJson);
  if (!parsed.success) return json({ error: "Invalid cart" }, 400, origin);

  try {
    const requestedIds = [...new Set(parsed.data.lines.map((line) => line.merchandiseId))];
    const preflight = await shopifyStorefrontRequest<ShopifyVariantPreflightData>(
      SHOPIFY_VARIANT_PREFLIGHT_QUERY,
      { ids: requestedIds },
    );
    const approvedIds = new Set(
      preflight.nodes
        .filter(
          (node): node is NonNullable<ShopifyVariantPreflightData["nodes"][number]> =>
            Boolean(
              node &&
                node.availableForSale &&
                node.product.availableForSale &&
                node.product.vendor === SHOPIFY_STOREFRONT.vendor,
            ),
        )
        .map((node) => node.id),
    );

    if (requestedIds.some((id) => !approvedIds.has(id))) {
      return json({ error: "Cart contains an unavailable item" }, 400, origin);
    }

    const created = await shopifyStorefrontRequest<ShopifyCartCreateData>(
      SHOPIFY_CART_CREATE_MUTATION,
      {
        input: {
          lines: parsed.data.lines,
          attributes: [
            { key: "source", value: "jussbeautifulhair.com" },
            { key: "bridge", value: "cloudflare-shopify-v1" },
          ],
        },
      },
    );

    if (created.cartCreate.userErrors.length > 0 || !created.cartCreate.cart) {
      return json({ error: "Shopify could not create this cart. Please refresh and try again." }, 409, origin);
    }

    const checkoutUrl = assertApprovedShopifyCheckoutUrl(created.cartCreate.cart.checkoutUrl);
    return json(
      {
        checkoutUrl,
        totalQuantity: created.cartCreate.cart.totalQuantity,
        cost: created.cartCreate.cart.cost,
      },
      200,
      origin,
    );
  } catch (error) {
    const errorType = error instanceof Error ? error.message : "UNKNOWN";
    console.error(`[SHOPIFY] Cart creation failed - ${errorType}`);
    return json({ error: "Shopify checkout is temporarily unavailable" }, 502, origin);
  }
}

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const allowedOrigins = getAllowedOrigins(env);
  const storeOrigin = allowedOrigins[0];
  const origin = request.headers.get("Origin");

  if (!storeOrigin || !env.STRIPE_SECRET_KEY) {
    return json({ error: "Payments are not configured" }, 503);
  }

  if (!origin || !allowedOrigins.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = await parseBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return json({ error: "Request too large" }, 413, origin);
    }
    return json({ error: "Invalid request" }, 400, origin);
  }

  const parsed = checkoutSchema.safeParse(parsedJson);
  if (!parsed.success) return json({ error: "Invalid cart" }, 400, origin);

  const canonicalItems = [] as Array<{
    id: string;
    name: string;
    variant: string;
    price: number;
    quantity: number;
    image: string;
  }>;

  for (const requested of parsed.data.items) {
    const product = getProduct(requested.id);
    const variant = product?.variants.find(
      (candidate) => candidate.option === requested.variant,
    );

    if (!product || !variant) {
      return json({ error: "Cart contains an unavailable item" }, 400, origin);
    }

    canonicalItems.push({
      id: product.id,
      name: product.name,
      variant: variant.option,
      price: variant.price,
      quantity: requested.quantity,
      image: product.image,
    });
  }

  const subtotal = Number(
    canonicalItems
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
      .toFixed(2),
  );
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = canonicalItems.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "usd",
      unit_amount: Math.round(item.price * 100),
      product_data: {
        name: `${item.name} (${item.variant})`,
        images: [new URL(item.image, storeOrigin).toString()],
        metadata: {
          kind: "product",
          product_id: item.id,
          variant: item.variant,
        },
      },
    },
  }));

  if (shipping > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(shipping * 100),
        product_data: {
          name: "Shipping",
          metadata: { kind: "shipping" },
        },
      },
    });
  }

  try {
    const stripe = createStripeClient(env);
    const reference = parsed.data.checkoutAttemptId;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_creation: "always",
        line_items: lineItems,
        billing_address_collection: "required",
        shipping_address_collection: { allowed_countries: ["US"] },
        phone_number_collection: { enabled: true },
        allow_promotion_codes: true,
        client_reference_id: reference,
        metadata: { checkout_attempt_id: reference },
        payment_intent_data: {
          metadata: { checkout_attempt_id: reference },
        },
        success_url: `${storeOrigin}/#/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${storeOrigin}/#/cart`,
      },
      { idempotencyKey: `jbh-checkout-${reference}` },
    );

    return json({ url: session.url }, 200, origin);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`[CHECKOUT] Stripe session creation failed - ${errorType}`);
    return json({ error: "Checkout failed. Please try again." }, 500, origin);
  }
}

async function handleCheckoutSessionVerification(
  request: Request,
  env: Env,
): Promise<Response> {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = request.headers.get("Origin");
  const responseOrigin = origin && allowedOrigins.includes(origin) ? origin : undefined;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Payments are not configured" }, 503, responseOrigin);
  }

  if (origin && !allowedOrigins.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const parsedSessionId = checkoutSessionIdSchema.safeParse(
    url.pathname.slice(CHECKOUT_SESSION_ROUTE_PREFIX.length),
  );

  if (!parsedSessionId.success) {
    return json({ error: "Checkout Session not found" }, 404, responseOrigin);
  }

  try {
    const session = await createStripeClient(env).checkout.sessions.retrieve(parsedSessionId.data);
    const reference = session.client_reference_id?.trim();
    const metadataReference = session.metadata?.checkout_attempt_id?.trim();
    const belongsToStore = Boolean(reference && metadataReference && reference === metadataReference);

    if (!belongsToStore) {
      return json({ error: "Checkout Session not found" }, 404, responseOrigin);
    }

    return json(
      {
        paid: session.status === "complete" && session.payment_status === "paid",
        status: session.status,
        paymentStatus: session.payment_status,
      },
      200,
      responseOrigin,
    );
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;

    if (statusCode === 400 || statusCode === 404) {
      return json({ error: "Checkout Session not found" }, 404, responseOrigin);
    }

    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`[CHECKOUT] Stripe session verification failed - ${errorType}`);
    return json({ error: "Payment verification unavailable" }, 502, responseOrigin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isApprovedRequestHost(request, env)) {
      return rejectedHostResponse();
    }

    const url = new URL(request.url);

    if (url.pathname === "/version") {
      return json({ ok: true, sha: getReleaseSha(env) });
    }

    if (url.pathname === "/api/shopify/catalog") {
      return handleShopifyCatalog(request);
    }

    if (url.pathname === "/api/shopify/cart") {
      return handleShopifyCart(request, env);
    }

    if (url.pathname === "/api/checkout") {
      return handleCheckout(request, env);
    }

    if (url.pathname.startsWith(CHECKOUT_SESSION_ROUTE_PREFIX)) {
      return handleCheckoutSessionVerification(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return secureAssetResponse(await env.ASSETS.fetch(request), env);
  },
};
