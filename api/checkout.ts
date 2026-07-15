import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { z } from "zod";
import { getProduct } from "../shared/catalog";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const FREE_SHIPPING_THRESHOLD = 150;
const FLAT_SHIPPING = 9.99;

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

function getAllowedOrigins(): string[] {
  const raw =
    process.env.ALLOWED_STOREFRONT_ORIGINS ||
    process.env.FRONTEND_URL ||
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = getAllowedOrigins();
  const storeOrigin = allowedOrigins[0];
  const requestOrigin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }
  if (!storeOrigin) {
    return res.status(503).json({ error: "store_origin_not_configured" });
  }
  if (!stripe) {
    return res.status(503).json({ error: "stripe_not_configured" });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_checkout_request" });
  }

  const resolvedItems = parsed.data.items.map((requested) => {
    const product = getProduct(requested.id);
    const variant = product?.variants.find(
      (candidate) => candidate.option === requested.variant,
    );
    return { requested, product, variant };
  });

  if (resolvedItems.some(({ product, variant }) => !product || !variant)) {
    return res.status(400).json({ error: "invalid_catalog_item" });
  }

  const subtotal = resolvedItems.reduce(
    (sum, { requested, variant }) =>
      sum + (variant?.price ?? 0) * requested.quantity,
    0,
  );
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = resolvedItems.map(
    ({ requested, product, variant }) => ({
      quantity: requested.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round((variant?.price ?? 0) * 100),
        product_data: {
          name: `${product?.name ?? requested.id} — ${requested.variant}`,
        },
      },
    }),
  );

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

  if (!session.url) {
    return res.status(502).json({ error: "stripe_session_missing_url" });
  }

  return res.status(200).json({ url: session.url });
}
