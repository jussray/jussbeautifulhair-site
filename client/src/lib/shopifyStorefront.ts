const SHOP_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN?.trim();

export interface ShopifyCartAttribute {
  key: "hair_goal" | "preferred_length" | "budget" | "maintenance";
  value: string;
}

export function isShopifyStorefrontConfigured(): boolean {
  return Boolean(SHOP_DOMAIN);
}

function normalizedShopDomain(): string {
  if (!SHOP_DOMAIN) {
    throw new Error("Shopify checkout is not configured yet.");
  }

  const domain = SHOP_DOMAIN.replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("Shopify checkout is not configured correctly.");
  }
  return domain;
}

function numericVariantId(merchandiseId: string): string {
  const match = merchandiseId.match(/^gid:\/\/shopify\/ProductVariant\/(\d+)$/);
  if (!match) {
    throw new Error("This Shopify product is not configured correctly.");
  }
  return match[1];
}

function normalizeAttributes(
  attributes: ShopifyCartAttribute[],
): Array<{ key: string; value: string }> {
  const normalized = attributes.map(({ key, value }) => ({
    key,
    value: value.trim().slice(0, 120),
  }));

  if (normalized.some(({ value }) => !value)) {
    throw new Error("Please complete your Hair Match preferences.");
  }

  return [
    { key: "source", value: "jussbeautifulhair.com" },
    { key: "offer", value: "jbh-hair-match-v1" },
    ...normalized,
  ];
}

export async function createShopifyCheckout(
  merchandiseId: string,
  quantity = 1,
  attributes: ShopifyCartAttribute[] = [],
): Promise<{ checkoutUrl: string }> {
  if (quantity !== 1) {
    throw new Error("Hair Match checkout supports one session at a time.");
  }

  const domain = normalizedShopDomain();
  const variantId = numericVariantId(merchandiseId);
  const checkout = new URL(`https://${domain}/cart/${variantId}:${quantity}`);

  for (const { key, value } of normalizeAttributes(attributes)) {
    checkout.searchParams.set(`attributes[${key}]`, value);
  }
  checkout.searchParams.set("ref", "jbh-hair-match-v1");

  return { checkoutUrl: checkout.toString() };
}
