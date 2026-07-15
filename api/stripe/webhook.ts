// Public-repository Stripe webhook verifier.
//
// The owner-only order mutation webhook lives in the private JBH backend. This
// public copy verifies Stripe signatures and acknowledges supported delivery
// without logging customer data or pretending to update private order records.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const MAX_WEBHOOK_BYTES = 1024 * 1024;

export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk) => {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_WEBHOOK_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getSignature(req: VercelRequest): string | null {
  const value = req.headers["stripe-signature"];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Stripe not configured");
  }

  const signature = getSignature(req);
  if (!signature) return res.status(400).send("Missing signature");

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    console.error("[WEBHOOK] Signature verification failed");
    return res.status(400).send("Invalid signature");
  }

  const safeId = event.id.slice(-8);
  console.log(`[WEBHOOK] verified ${event.type} — event …${safeId}`);
  return res.status(200).json({ received: true });
}
