import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Lock, Info } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import { observeFunnel } from "@/lib/funnel";
import { assertApprovedShopifyCheckoutRedirect } from "@/lib/shopifyCatalog";
import { assertApprovedCheckoutRedirect } from "@/lib/checkoutRedirect.mjs";

export default function Checkout() {
  const { items, subtotal } = useCart();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"shopify" | "sandbox" | "live">("shopify");
  const [checkoutModeResolved, setCheckoutModeResolved] = useState(false);
  const jussPayMode = checkoutMode !== "shopify";
  const checkoutAttempt = useRef<{ cart: string; requestId: string } | null>(null);
  const totalQuantity = items.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    let active = true;
    const discoverCheckoutMode = async () => {
      const ready = async (path: string, mode: "live" | "sandbox") => {
        try {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) return false;
          return (await response.json()).mode === mode;
        } catch {
          return false;
        }
      };

      if (await ready("/api/jusspay/live/checkout", "live")) {
        if (active) { setCheckoutMode("live"); setCheckoutModeResolved(true); }
        return;
      }
      if (await ready("/api/jusspay/sandbox/checkout", "sandbox")) {
        if (active) { setCheckoutMode("sandbox"); setCheckoutModeResolved(true); }
        return;
      }
      if (active) { setCheckoutMode("shopify"); setCheckoutModeResolved(true); }
    };

    void discoverCheckoutMode();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    observeFunnel({
      event: "checkout_start",
      route: window.location.pathname,
      quantity: totalQuantity,
      valueCents: Math.round(subtotal * 100),
    });
  }, [items.length, subtotal, totalQuantity]);

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
    if (!checkoutModeResolved || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const cartFingerprint = JSON.stringify(items.map((item) => [item.variantId, item.qty]));
      if (!checkoutAttempt.current || checkoutAttempt.current.cart !== cartFingerprint) {
        checkoutAttempt.current = { cart: cartFingerprint, requestId: crypto.randomUUID() };
      }
      const checkoutPath =
        checkoutMode === "live"
          ? "/api/jusspay/live/checkout"
          : checkoutMode === "sandbox"
            ? "/api/jusspay/sandbox/checkout"
            : "/api/shopify/cart";
      const response = await fetch(checkoutPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(jussPayMode ? { requestId: checkoutAttempt.current.requestId, shipping: "standard" } : {}),
          lines: items.map((item) => ({
            merchandiseId: item.variantId,
            quantity: item.qty,
          })),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        url?: string;
        error?: string;
      };
      if (!response.ok || !(jussPayMode ? data.url : data.checkoutUrl)) {
        throw new Error(data.error || "Checkout is temporarily unavailable. Please try again.");
      }

      const approvedCheckoutUrl = jussPayMode ? assertApprovedCheckoutRedirect(data.url!) : assertApprovedShopifyCheckoutRedirect(data.checkoutUrl!);
      observeFunnel({
        event: jussPayMode ? "checkout_start" : "shopify_handoff",
        route: window.location.pathname,
        quantity: totalQuantity,
        valueCents: Math.round(subtotal * 100),
      });
      window.location.assign(approvedCheckoutUrl);
    } catch (checkoutError) {
      observeFunnel({
        event: "checkout_error",
        route: window.location.pathname,
        quantity: totalQuantity,
        valueCents: Math.round(subtotal * 100),
      });
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout failed. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2">Checkout</h1>
        <p className="text-muted-foreground mb-8">
          {checkoutMode === "sandbox"
            ? "JBH test checkout uses test mode. No real payment will be collected."
            : checkoutMode === "live"
              ? "Review your items, then continue to secure Juss Beautiful Hair checkout."
              : "Review your items, then continue to Shopify for final availability, shipping, taxes, discounts, and payment."}
        </p>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <section className="rounded-lg border border-card-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground mb-4">
                {checkoutMode === "sandbox" ? "JBH test checkout" : checkoutMode === "live" ? "Secure JBH checkout" : "Secure Shopify checkout"}
              </h2>
              <div className="flex items-start gap-3 rounded-md bg-secondary/30 px-4 py-4 text-sm text-primary">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p>
                    {checkoutMode === "sandbox"
                      ? "Test-only checkout. Orders are not automatically sent to vendors."
                      : checkoutMode === "live"
                        ? "JBH securely collects the information required to complete your order. Payment truth stays server-side."
                        : "Shopify confirms current variant availability and securely collects the information required to complete your order."}
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
                  {checkoutMode === "sandbox"
                    ? "Test prices and shipping are calculated by the server. Displayed subtotal is informational."
                    : checkoutMode === "live"
                      ? "Final JBH order totals are calculated server-side before payment."
                      : "Final order totals are calculated by Shopify before payment."}
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                disabled={submitting || !checkoutModeResolved}
                onClick={placeOrder}
                data-testid="button-place-order"
                className="mt-6 w-full font-semibold"
              >
                <Lock className="mr-2 h-4 w-4" />
                {!checkoutModeResolved
                  ? "Checking secure checkout…"
                  : submitting
                    ? "Opening checkout…"
                  : checkoutMode === "sandbox"
                    ? "Continue to JBH test checkout"
                    : checkoutMode === "live"
                      ? `Continue to JBH checkout — ${formatPrice(subtotal)}`
                      : `Continue to Shopify — ${formatPrice(subtotal)}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
