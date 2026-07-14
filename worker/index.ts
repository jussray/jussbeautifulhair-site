import Stripe from "stripe";
import { z } from "zod";
import { getProduct } from "../client/src/lib/catalog";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetBinding;
  STRIPE_SECRET_KEY: string;
  STORE_ORIGIN?: string;
  ALLOWED_STOREFRONT_ORIGINS?: string;
}

const FREE_SHIPPING_THRESHOLD = 150;
const FLAT_SHIPPING = 9.99;
const MAX_BODY_BYTES = 64 * 1024;

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

function isApprovedRequestHost(request: Request, env: Env): boolean {
  const requestHostname = new URL(request.url).hostname.toLowerCase();

  // Preserve local Wrangler/Vite development without allowing workers.dev or
  // temporary preview hostnames in production.
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

function secureAssetResponse(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  secured.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; " +
      "connect-src 'self'; form-action 'self' https://checkout.stripe.com; upgrade-insecure-requests",
  );
  secured.headers.set("Content-Signal", "ai-train=no, search=yes, ai-input=no");
  return secured;
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

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large" }, 413, origin);
  }

  let parsedJson: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, origin);
    }
    parsedJson = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request" }, 400, origin);
  }

  const parsed = checkoutSchema.safeParse(parsedJson);
  if (!parsed.success) return json({ error: "Invalid cart" }, 400, origin);

  const canonicalItems = [] as Array<{
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
  const shipping =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    canonicalItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: `${item.name} (${item.variant})`,
          images: [new URL(item.image, storeOrigin).toString()],
        },
      },
    }));

  if (shipping > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(shipping * 100),
        product_data: { name: "Shipping" },
      },
    });
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });
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
    console.error(`[CHECKOUT] Stripe session creation failed — ${errorType}`);
    return json({ error: "Checkout failed. Please try again." }, 500, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isApprovedRequestHost(request, env)) {
      return rejectedHostResponse();
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/checkout") {
      return handleCheckout(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return secureAssetResponse(await env.ASSETS.fetch(request));
  },
};
