#!/bin/bash
mkdir -p api client/src/lib client/src/pages

cat > api/checkout.ts << 'ENDOFFILE'
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
ENDOFFILE

cat > client/src/lib/checkout.ts << 'ENDOFFILE'
export interface CartItem { id: string; name: string; price: number; quantity: number; image?: string; description?: string; }
export async function redirectToCheckout(items: CartItem[]): Promise<void> {
  if (!items.length) throw new Error("Your bag is empty.");
  const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data?.error ?? "Checkout failed. Please try again.");
  window.location.href = data.url;
}
ENDOFFILE

cat > client/src/pages/success.tsx << 'ENDOFFILE'
import { useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
export default function SuccessPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  useEffect(() => { if (!clearedRef.current) { clearedRef.current = true; clearCart(); } }, [clearCart]);
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center space-y-5 shadow-sm">
        <div className="flex justify-center"><CheckCircle2 className="w-14 h-14 text-green-500" strokeWidth={1.5} /></div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Order confirmed!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">Thank you for shopping with Juss Beautiful Hair. A confirmation email is on its way and we'll keep you updated as your order ships.</p>
        </div>
        {sessionId && <p className="text-xs text-muted-foreground">Order ref: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{sessionId.slice(-12)}</code></p>}
        <Link href="/shop"><Button className="w-full" size="lg">Keep shopping</Button></Link>
      </div>
    </div>
  );
}
ENDOFFILE

echo "✅ All files created. Now run: git add . && git commit -m 'feat: stripe checkout' && git push"
