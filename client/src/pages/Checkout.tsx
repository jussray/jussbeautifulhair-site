import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Info } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import { assertApprovedShopifyCheckoutRedirect } from "@/lib/shopifyCatalog";

export default function Checkout() {
  const { items, subtotal } = useCart();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/shopify/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: items.map((item) => ({
            merchandiseId: item.variantId,
            quantity: item.qty,
          })),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Shopify checkout failed. Please try again.");
      }

      window.location.assign(assertApprovedShopifyCheckoutRedirect(data.checkoutUrl));
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Shopify checkout failed. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2">Checkout</h1>
        <p className="text-muted-foreground mb-8">
          Review your items, then continue to Shopify for final availability, shipping, taxes, discounts, and payment.
        </p>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <section className="rounded-lg border border-card-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground mb-4">Secure Shopify checkout</h2>
              <div className="flex items-start gap-3 rounded-md bg-secondary/30 px-4 py-4 text-sm text-primary">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p>
                    Shopify confirms current variant availability and securely collects the information required to complete your order.
                  </p>
                  <p>
                    Juss Beautiful Hair does not place payment credentials or customer contact details in the public storefront bundle.
                  </p>
                </div>
              </div>
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-lg border border-card-border bg-card p-6 sticky top-28">
              <h2 className="font-display text-xl text-foreground mb-4">Order Summary</h2>
              <div className="space-y-3 max-h-64 overflow-auto mb-4">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-3 text-sm">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-12 w-12 rounded object-cover bg-muted shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-tight line-clamp-2">{item.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.variant} × {item.qty}
                      </p>
                    </div>
                    <span className="text-foreground font-medium">
                      {formatPrice(item.price * item.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-lg text-foreground">Current subtotal</span>
                  <span className="text-2xl font-semibold text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Final order totals are calculated by Shopify before payment.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                disabled={submitting}
                onClick={placeOrder}
                data-testid="button-place-order"
                className="mt-6 w-full font-semibold"
              >
                <Lock className="mr-2 h-4 w-4" />
                {submitting ? "Opening Shopify…" : `Continue to Shopify — ${formatPrice(subtotal)}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
