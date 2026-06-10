import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" });
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = process.env.FRONTEND_URL || "https://jussbeautifulhair.com";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { items } = req.body as { items: { id: string; name: string; price: number; quantity: number; image?: string; description?: string }[] };
  if (!items?.length) return res.status(400).json({ error: "Cart is empty" });
  const siteUrl = process.env.FRONTEND_URL || "https://jussbeautifulhair.com";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map((item) => ({
        price_data: {
          currency: "usd",
          unit_amount: Math.round(item.price * 100),
          product_data: { name: item.name, ...(item.description ? { description: item.description } : {}), ...(item.image ? { images: [item.image] } : {}) },
        },
        quantity: item.quantity,
      })),
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["US"] },
      allow_promotion_codes: true,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Stripe error" });
  }
}
