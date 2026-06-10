export interface CartItem { id: string; name: string; price: number; quantity: number; image?: string; description?: string; }
export async function redirectToCheckout(items: CartItem[]): Promise<void> {
  if (!items.length) throw new Error("Your bag is empty.");
  const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data?.error ?? "Checkout failed. Please try again.");
  window.location.href = data.url;
}
