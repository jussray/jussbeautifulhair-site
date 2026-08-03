const SHOP_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN?.trim();
const STOREFRONT_ACCESS = import.meta.env.VITE_SHOPIFY_STOREFRONT_ACCESS?.trim();
const API_VERSION = import.meta.env.VITE_SHOPIFY_STOREFRONT_API_VERSION?.trim() || "2026-07";

interface ShopifyMoney {
  amount: string;
  currencyCode: string;
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

export async function createShopifyCheckout(
  merchandiseId: string,
  quantity = 1,
): Promise<{ checkoutUrl: string; total: ShopifyMoney }> {
  if (!merchandiseId.startsWith("gid://shopify/ProductVariant/")) {
    throw new Error("This Shopify product is not configured correctly.");
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
          attributes: [{ key: "source", value: "jussbeautifulhair.com" }],
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
