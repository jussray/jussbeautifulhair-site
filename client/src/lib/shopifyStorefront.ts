import { assertApprovedShopifyCheckoutRedirect } from "@/lib/shopifyCatalog";

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

function normalizeAttributes(
  attributes: ShopifyCartAttribute[],
): Array<{ key: ShopifyCartAttribute["key"]; value: string }> {
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

  return normalized;
}

export async function createHairMatchCheckout(
  attributes: ShopifyCartAttribute[],
): Promise<{ checkoutUrl: string }> {
  const response = await fetch("/api/shopify/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: [
        {
          merchandiseId: HAIR_MATCH_SHOPIFY_CONTRACT.variantGid,
          quantity: HAIR_MATCH_SHOPIFY_CONTRACT.quantity,
        },
      ],
      hairMatch: {
        offer: HAIR_MATCH_SHOPIFY_CONTRACT.offerCode,
        attributes: normalizeAttributes(attributes),
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    checkoutUrl?: string;
    error?: string;
  };
  if (!response.ok || !payload.checkoutUrl) {
    throw new Error(payload.error || "Shopify checkout could not be started. Please try again.");
  }

  return {
    checkoutUrl: assertApprovedShopifyCheckoutRedirect(payload.checkoutUrl),
  };
}
