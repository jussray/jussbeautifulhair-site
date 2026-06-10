import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Info } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";

export default function Checkout() {
  const { items, subtotal, shipping, total } = useCart();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
  });

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl text-foreground">Your cart is empty</h1>
          <Button className="mt-6" onClick={() => navigate("/shop")}>
            Shop Now
          </Button>
        </div>
      </Layout>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const orderItems = items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.qty,
        image: i.image,
      }));
      const metadata: Record<string, string> = {
        customer_name: form.customerName,
        email: form.email,
        phone: form.phone,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        order_notes: form.notes,
        order_items: items
          .map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ""} x${i.qty}`)
          .join(", "),
      };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: orderItems, metadata, shippingFlat: shipping }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data?.error ?? "Checkout failed. Please try again.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2">
          Checkout
        </h1>
        <p className="text-muted-foreground mb-8">
          Almost there. Just a few details and your order is on its way.
        </p>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-3 gap-10">
          {/* Form */}
          <div className="lg:col-span-2 space-y-8">
            <section className="rounded-lg border border-card-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground mb-4">
                Contact
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={form.customerName} onChange={set("customerName")} data-testid="input-name" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={form.email} onChange={set("email")} data-testid="input-email" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" required value={form.phone} onChange={set("phone")} data-testid="input-phone" className="mt-1.5" />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-card-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground mb-4">
                Shipping Address
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="street">Street address</Label>
                  <Input id="street" required value={form.street} onChange={set("street")} data-testid="input-street" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={form.city} onChange={set("city")} data-testid="input-city" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" required value={form.state} onChange={set("state")} data-testid="input-state" className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP</Label>
                    <Input id="zip" required value={form.zip} onChange={set("zip")} data-testid="input-zip" className="mt-1.5" />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="notes">Order notes (optional)</Label>
                <Textarea id="notes" value={form.notes} onChange={set("notes")} data-testid="input-notes" className="mt-1.5" placeholder="Anything we should know?" />
              </div>
            </section>

            <section className="rounded-lg border border-card-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground mb-4">
                Payment
              </h2>
              <div className="flex items-start gap-3 rounded-md bg-secondary/30 px-4 py-3 text-sm text-primary">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <p>
                  You'll be redirected to Stripe's secure checkout to complete your payment. Your order details and shipping address are saved with your payment so we know exactly what to fulfill.
                </p>
              </div>
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
            </section>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-card-border bg-card p-6 sticky top-28">
              <h2 className="font-display text-xl text-foreground mb-4">
                Order Summary
              </h2>
              <div className="space-y-3 max-h-64 overflow-auto mb-4">
                {items.map((i) => (
                  <div key={`${i.id}-${i.variant}`} className="flex gap-3 text-sm">
                    <img src={i.image} alt="" className="h-12 w-12 rounded object-cover bg-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-tight line-clamp-2">{i.name}</p>
                      <p className="text-muted-foreground text-xs">{i.variant} × {i.qty}</p>
                    </div>
                    <span className="text-foreground font-medium">{formatPrice(i.price * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-foreground font-medium">{shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
                </div>
              </div>
              <div className="border-t border-border my-4" />
              <div className="flex justify-between items-baseline mb-6">
                <span className="font-display text-lg text-foreground">Total</span>
                <span className="text-2xl font-semibold text-foreground">{formatPrice(total)}</span>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                data-testid="button-place-order"
                className="w-full font-semibold"
              >
                <Lock className="mr-2 h-4 w-4" />
                {submitting ? "Redirecting…" : `Pay with Stripe — ${formatPrice(total)}`}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
