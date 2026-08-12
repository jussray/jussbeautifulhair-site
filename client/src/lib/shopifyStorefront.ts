export const HAIR_MATCH_SHOPIFY_CONTRACT = Object.freeze({
  shopDomain: "8qp1z2-az.myshopify.com",
  variantGid: "gid://shopify/ProductVariant/50196622344435",
  offerCode: "jbh-hair-match-v1",
  source: "jussbeautifulhair.com",
  quantity: 1,
  priceUsd: "25.00",
});

export interface ShopifyCartAttribute {
  key: "hair_goal" | "preferred_length" | "budget" | "maintenance";
  value: string;
}

function normalizedShopDomain(): string {
  const domain = HAIR_MATCH_SHOPIFY_CONTRACT.shopDomain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("Shopify checkout is not configured correctly.");
  }
  return domain;
}

function numericVariantId(): string {
  const match = HAIR_MATCH_SHOPIFY_CONTRACT.variantGid.match(
    /^gid:\/\/shopify\/ProductVariant\/(\d+)$/,
  );
  if (!match) {
    throw new Error("This Shopify product is not configured correctly.");
  }
  return match[1];
}

function normalizeAttributes(
  attributes: ShopifyCartAttribute[],
): Array<{ key: string; value: string }> {
  const expectedKeys = new Set<ShopifyCartAttribute["key"]>([
    "hair_goal",
    "preferred_length",
    "budget",
    "maintenance",
  ]);
  const seen = new Set<string>();
  const normalized = attributes.map(({ key, value }) => {
    if (!expectedKeys.has(key) || seen.has(key)) {
      throw new Error("Hair Match preferences are not configured correctly.");
    }
    seen.add(key);
    return { key, value: value.trim().slice(0, 120) };
  });

  if (
    normalized.length !== expectedKeys.size ||
    normalized.some(({ value }) => !value)
  ) {
    throw new Error("Please complete your Hair Match preferences.");
  }

  return [
    {
      key: "source",
      value: HAIR_MATCH_SHOPIFY_CONTRACT.source,
    },
    {
      key: "offer",
      value: HAIR_MATCH_SHOPIFY_CONTRACT.offerCode,
    },
    ...normalized,
  ];
}

export function createHairMatchCheckout(
  attributes: ShopifyCartAttribute[],
): { checkoutUrl: string } {
  const domain = normalizedShopDomain();
  const variantId = numericVariantId();
  const checkout = new URL(
    `https://${domain}/cart/${variantId}:${HAIR_MATCH_SHOPIFY_CONTRACT.quantity}`,
  );

  for (const { key, value } of normalizeAttributes(attributes)) {
    checkout.searchParams.set(`attributes[${key}]`, value);
  }
  checkout.searchParams.set("ref", HAIR_MATCH_SHOPIFY_CONTRACT.offerCode);

  return { checkoutUrl: checkout.toString() };
}
