// _worker.js — Cloudflare Pages (Direct Upload, Advanced Mode)
// Serves the static site AND handles:
//   POST /api/checkout      → creates a Stripe Checkout Session
//   GET  /api/orders/:id    → returns order details for the confirmation page
//
// Required secret (set in Pages project → Settings → Variables and Secrets):
//   STRIPE_SECRET_KEY  = sk_test_... (or sk_live_... when ready)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env, url.origin);
    }

    const orderMatch = url.pathname.match(/^\/api\/orders\/(cs_[A-Za-z0-9_]+)$/);
    if (orderMatch && request.method === "GET") {
      return handleOrderLookup(orderMatch[1], env);
    }

    // Everything else: static assets
    return env.ASSETS.fetch(request);
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function handleCheckout(request, env, origin) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Payment system not configured." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const { items, shipping, customer } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "Your cart is empty." }, 400);
  }

  for (const it of items) {
    if (
      typeof it.name !== "string" ||
      typeof it.price !== "number" ||
      typeof it.qty !== "number" ||
      it.price <= 0 ||
      it.qty < 1
    ) {
      return json({ error: "Invalid item in cart." }, 400);
    }
  }

  const p = new URLSearchParams();
  p.append("mode", "payment");
  p.append("success_url", `${origin}/#/confirmation/{CHECKOUT_SESSION_ID}`);
  p.append("cancel_url", `${origin}/#/checkout`);
  p.append("billing_address_collection", "required");
  p.append("shipping_address_collection[allowed_countries][0]", "US");
  p.append("allow_promotion_codes", "true");
  if (customer?.email) p.append("customer_email", customer.email);

  items.forEach((it, i) => {
    const name = it.variant ? `${it.name} — ${it.variant}` : it.name;
    p.append(`line_items[${i}][price_data][currency]`, "usd");
    p.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(it.price * 100)));
    p.append(`line_items[${i}][price_data][product_data][name]`, name.slice(0, 250));
    if (it.image && /^https?:\/\//.test(it.image)) {
      p.append(`line_items[${i}][price_data][product_data][images][0]`, it.image);
    }
    p.append(`line_items[${i}][quantity]`, String(it.qty));
  });

  if (typeof shipping === "number" && shipping > 0) {
    const i = items.length;
    p.append(`line_items[${i}][price_data][currency]`, "usd");
    p.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(shipping * 100)));
    p.append(`line_items[${i}][price_data][product_data][name]`, "Shipping");
    p.append(`line_items[${i}][quantity]`, "1");
  }

  // ── Metadata: everything needed to fulfill with the vendor ──
  // Shows on the payment in the Stripe dashboard + in Stripe's email.
  const c = customer || {};
  const meta = {
    customer_name: c.customerName || "",
    customer_email: c.email || "",
    customer_phone: c.phone || "",
    ship_street: c.street || "",
    ship_city: c.city || "",
    ship_state: c.state || "",
    ship_zip: c.zip || "",
    order_notes: c.notes || "",
    order_items: items
      .map((it) => `${it.qty}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
      .join("; "),
    items_json: JSON.stringify(
      items.map((it) => ({
        id: it.id, name: it.name, variant: it.variant,
        qty: it.qty, price: it.price, image: it.image,
      }))
    ),
  };
  for (const [k, v] of Object.entries(meta)) {
    const val = String(v).slice(0, 490);
    p.append(`metadata[${k}]`, val);
    p.append(`payment_intent_data[metadata][${k}]`, val);
  }

  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: p.toString(),
    });
  } catch {
    return json({ error: "Could not reach payment provider. Try again." }, 502);
  }

  const session = await res.json();
  if (!res.ok) {
    return json({ error: session?.error?.message || "Payment setup failed." }, 502);
  }
  return json({ url: session.url });
}

async function handleOrderLookup(sessionId, env) {
  if (!env.STRIPE_SECRET_KEY) return json({}, 200);

  let res;
  try {
    res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
  } catch {
    return json({}, 200);
  }
  if (!res.ok) return json({}, 200);

  const s = await res.json();
  const m = s.metadata || {};

  let items = [];
  try {
    items = JSON.parse(m.items_json || "[]");
  } catch {}

  return json({
    id: sessionId,
    customerName: m.customer_name || s.customer_details?.name || "",
    itemsJson: items,
    subtotal: items.reduce((t, i) => t + (i.price || 0) * (i.qty || 0), 0),
    shipping:
      (s.amount_total || 0) / 100 -
      items.reduce((t, i) => t + (i.price || 0) * (i.qty || 0), 0),
    total: (s.amount_total || 0) / 100,
  });
}
