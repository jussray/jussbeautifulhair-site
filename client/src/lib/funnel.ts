export type FunnelEventName =
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "shopify_handoff"
  | "checkout_error";

export type FunnelEvent = {
  event: FunnelEventName;
  productHandle?: string;
  variantId?: string;
  route?: string;
  quantity?: number;
  valueCents?: number;
};

export function observeFunnel(event: FunnelEvent): void {
  try {
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never interrupt commerce.
  }
}
