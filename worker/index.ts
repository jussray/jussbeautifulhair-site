import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { getProduct } from "../shared/catalog";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetBinding;
  STRIPE_SECRET_KEY: string;
  DATABASE_URL?: string;
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

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(2).max(5000),
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

function getRequestOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("Origin") || undefined;
  if (!origin || !getAllowedOrigins(env).includes(origin)) return undefined;
  return origin;
}

function optionsResponse(origin: string): Response {
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

async function readJsonBody(request: Request, origin: string): Promise<unknown | Response> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large" }, 413, origin);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, origin);
    }
    return JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request" }, 400, origin);
  }
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(request, env);
  if (!origin) return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return optionsResponse(origin);
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }

  if (!env.DATABASE_URL) {
    return json({ error: "Contact service is temporarily unavailable" }, 503, origin);
  }

  const body = await readJsonBody(request, origin);
  if (body instanceof Response) return body;

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid contact message" }, 400, origin);

  try {
    const sql = neon(env.DATABASE_URL);
    await sql`
      INSERT INTO contact_messages (name, email, message)
      VALUES (${parsed.data.name}, ${parsed.data.email}, ${parsed.data.message})
    `;
    return json({ received: true }, 201, origin);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`[CONTACT] Message persistence failed — ${errorType}`);
    return json({ error: "We couldn't save your message" }, 500, origin);
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

  if (request.method === "OPTIONS") return optionsResponse(origin);

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }

  const parsedJson = await readJsonBody(request, origin);
  if (parsedJson instanceof Response) return parsedJson;

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
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = canonicalItems.map((item) => ({
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
      apiVersion: "2025-02-24.acacia",
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
        payment_intent_data: { metadata: { checkout_attempt_id: reference } },
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

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    if (url.pathname === "/api/checkout") {
      return handleCheckout(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return secureAssetResponse(await env.ASSETS.fetch(request));
  },
};
