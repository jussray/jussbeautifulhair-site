// Client-side helper that calls POST /api/checkout and redirects to Stripe.
// Payload shape must match the Zod schema in api/checkout.ts exactly.

export interface CheckoutItem {
  id: string;
  variant: string;
  quantity: number;
}

function generateAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

export async function redirectToCheckout(items: CheckoutItem[]): Promise<void> {
  if (!items.length) throw new Error("Your bag is empty.");

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutAttemptId: generateAttemptId(),
      items,
    }),
  });

  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data?.error ?? "Checkout failed. Please try again.");
  }

  window.location.assign(data.url);
}
