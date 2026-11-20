// Explicit first-party Stripe catalog authority. No approved offers means no checkout.
// Prices come from the tracked server catalog and must match each manually approved offer.
const ACCOUNT_ID = /^acct_[A-Za-z0-9]{8,64}$/;
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function getStripeCommerceState(env, products, requestUrl) {
  const mode = env.JBH_STRIPE_COMMERCE_MODE;
  if (mode === "test" && requestUrl) {
    let host;
    try { host = new URL(requestUrl).hostname.toLowerCase(); } catch { return null; }
    if (host === "jussbeautifulhair.com" || host === "www.jussbeautifulhair.com") return null;
  }
  if (mode !== "test" && mode !== "live") return null;
  if (env.ENABLE_LEGACY_STRIPE_CHECKOUT !== "true") return null;
  if (!ACCOUNT_ID.test(env.JBH_STRIPE_ACCOUNT_ID || "")) return null;
  if (mode === "live" && (env.JBH_STRIPE_ACCOUNT_ID !== "acct_1TfbELRp7J40bCrl" ||
    env.JBH_STRIPE_LIVE_ENABLED !== "true" ||
    env.JBH_STRIPE_FULFILLMENT_READY !== "true"
  )) return null;

  const key = env.STRIPE_SECRET_KEY || "";
  if (!key.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) return null;

  let approvals;
  try { approvals = JSON.parse(env.JBH_STRIPE_APPROVED_OFFERS || "null"); }
  catch { return null; }
  if (!Array.isArray(approvals) || approvals.length === 0 || approvals.length > 100) return null;

  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  const allow = new Map();
  for (const approval of approvals) {
    if (!approval || typeof approval !== "object" || Array.isArray(approval)) return null;
    if (Object.keys(approval).sort().join(",") !== "id,priceCents,variant") return null;
    const { id, variant, priceCents } = approval;
    if (typeof id !== "string" || !PRODUCT_ID.test(id) ||
        typeof variant !== "string" || !variant ||
        !Number.isSafeInteger(priceCents) || priceCents <= 0) return null;
    const product = byId.get(id);
    const variantIndex = product?.variants.findIndex((v) => v.option === variant) ?? -1;
    if (!product || variantIndex < 0 ||
        Math.round(product.variants[variantIndex].price * 100) !== priceCents) return null;
    const identity = id + ":" + variantIndex;
    if (seen.has(identity)) return null;
    seen.add(identity);
    if (!allow.has(id)) allow.set(id, []);
    allow.get(id).push({
      id: "jbh:" + identity,
      option: variant,
      price: priceCents / 100,
      availableForSale: true,
    });
  }

  const catalog = products.filter((product) => allow.has(product.id)).map((product) => ({
    id: product.id,
    shopifyProductId: "jbh:catalog",
    name: product.name,
    category: product.category,
    tagline: product.tagline,
    description: product.description,
    variants: allow.get(product.id),
    badge: product.badge,
    image: product.image,
    availableForSale: true,
  }));
  return { mode, catalog, approved: seen };
}
