// Explicit first-party Stripe catalog authority. No approved offers means no checkout.
// Prices come from the tracked server catalog and must match each manually approved offer.
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function getStripeCommerceState(env, products, requestUrl) {
  const mode = env.JBH_STRIPE_COMMERCE_MODE;
  // This catalog is a test-only front door to the existing JussPay order ledger.
  // Never permit live checkout through the separate legacy Stripe session handler.
  if (mode !== "test" || env.JBH_JUSSPAY_SANDBOX_ENABLED !== "true") return null;
  if (!requestUrl) return null;
  let host;
  try { host = new URL(requestUrl).hostname.toLowerCase(); } catch { return null; }
  if (host === "jussbeautifulhair.com" || host === "www.jussbeautifulhair.com") return null;
  if (!env.JBH_JUSSPAY || typeof env.JBH_JUSSPAY.fetch !== "function" ||
      typeof env.JBH_JUSSPAY_STOREFRONT_KEY !== "string" ||
      env.JBH_JUSSPAY_STOREFRONT_KEY.length < 32) return null;

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

  // Require an exact SKU mapping for every approved variant. No hidden offers.
  let mapping;
  try { mapping = JSON.parse(env.JBH_JUSSPAY_VARIANT_SKUS || "null"); }
  catch { return null; }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return null;
  const mappingKeys = Object.keys(mapping);
  if (mappingKeys.length !== seen.size) return null;
  for (const [id, sku] of Object.entries(mapping)) {
    if (!/^jbh:[a-z0-9][a-z0-9-]{0,99}:[0-9]+$/.test(id) ||
        typeof sku !== "string" || !/^[A-Z0-9][A-Z0-9-]{1,63}$/.test(sku)) return null;
    const suffix = id.slice(4);
    if (!seen.has(suffix)) return null;
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
