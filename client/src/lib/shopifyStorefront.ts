const SHOP_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN?.trim();
const STOREFRONT_ACCESS = import.meta.env.VITE_SHOPIFY_STOREFRONT_ACCESS?.trim();
const API_VERSION = import.meta.env.VITE_SHOPIFY_STOREFRONT_API_VERSION?.trim() || "2026-07";

interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyCartAttribute {
  key: "hair_goal" | "preferred_length" | "budget" | "maintenance";
  value: string;
}

interface ShopifyCartCreateResponse {
  data?: {
    cartCreate?: {
      cart?: {
        id: string;
        checkoutUrl: string;
        cost: {
          totalAmount: ShopifyMoney;
        };
      };
      userErrors?: Array<{ field?: string[]; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export function isShopifyStorefrontConfigured(): boolean {
  return Boolean(SHOP_DOMAIN && STOREFRONT_ACCESS);
}

function storefrontEndpoint(): string {
  if (!SHOP_DOMAIN || !STOREFRONT_ACCESS) {
    throw new Error("Shopify checkout is not configured yet.");
  }

  const normalizedDomain = SHOP_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${normalizedDomain}/api/${API_VERSION}/graphql.json`;
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
): Promise<{ checkoutUrl: string; total: ShopifyMoney }> {
  if (!merchandiseId.startsWith("gid://shopify/ProductVariant/")) {
    throw new Error("This Shopify product is not configured correctly.");
  }
  if (quantity !== 1) {
    throw new Error("Hair Match checkout supports one session at a time.");
  }

  const response = await fetch(storefrontEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS as string,
    },
    body: JSON.stringify({
      query: `
        mutation CreateCart($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              cost {
                totalAmount {
                  amount
                  currencyCode
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        input: {
          lines: [{ merchandiseId, quantity }],
          attributes: normalizeAttributes(attributes),
        },
      },
    }),
  });

  const payload = (await response.json()) as ShopifyCartCreateResponse;
  const userError = payload.data?.cartCreate?.userErrors?.[0]?.message;
  const graphqlError = payload.errors?.[0]?.message;
  const cart = payload.data?.cartCreate?.cart;

  if (!response.ok || !cart?.checkoutUrl) {
    throw new Error(userError || graphqlError || "Shopify checkout could not be started.");
  }

  const checkout = new URL(cart.checkoutUrl);
  if (checkout.protocol !== "https:") {
    throw new Error("Shopify returned an unsafe checkout URL.");
  }

  return {
    checkoutUrl: checkout.toString(),
    total: cart.cost.totalAmount,
  };
}
