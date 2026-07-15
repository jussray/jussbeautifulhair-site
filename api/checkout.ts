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

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!stripe || !storeOrigin) {
    return res.status(503).json({ error: "Payments are not configured" });
  }

  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid cart" });
  }

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
      return res.status(400).json({ error: "Cart contains an unavailable item" });
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
    const safeReference = parsed.data.checkoutAttemptId;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_creation: "always",
        line_items: lineItems,
        billing_address_collection: "required",
        shipping_address_collection: { allowed_countries: ["US"] },
        phone_number_collection: { enabled: true },
        allow_promotion_codes: true,
        client_reference_id: safeReference,
        metadata: { checkout_attempt_id: safeReference },
        payment_intent_data: {
          metadata: { checkout_attempt_id: safeReference },
        },
        success_url: `${storeOrigin}/#/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${storeOrigin}/#/cart`,
      },
      { idempotencyKey: `jbh-checkout-${safeReference}` },
    );

    return res.status(200).json({ url: session.url });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`[CHECKOUT] Stripe session creation failed — ${errorType}`);
    return res.status(500).json({ error: "Checkout failed. Please try again." });
  }
}
