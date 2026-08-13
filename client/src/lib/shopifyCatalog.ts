import { useQuery } from "@tanstack/react-query";

export interface StoreVariant {
  id: string;
  option: string;
  price: number;
  availableForSale: boolean;
}

export interface StoreProduct {
  id: string;
  shopifyProductId: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  variants: StoreVariant[];
  badge?: string;
  image: string;
  availableForSale: boolean;
}

interface CatalogPayload {
  products?: unknown;
}

interface JbhPresentation {
  name: string;
  category: StoreProduct["category"];
  tagline: string;
  description: string;
  image: string;
  allowedOptions: readonly string[];
}

export const SHOPIFY_PUBLIC_CONTRACT = Object.freeze({
  shopDomain: "8qp1z2-az.myshopify.com",
  apiVersion: "2026-07",
  vendor: "JBH",
  checkoutHosts: ["jussbeautifulhair.com", "8qp1z2-az.myshopify.com"] as const,
});

// Shopify owns live variant IDs, price, and availability. JBH owns every field a
// customer sees. Unmapped supplier imports and unapproved supplier options are
// intentionally excluded instead of leaking supplier merchandising into the store.
export const JBH_PRESENTATION_BY_HANDLE: Readonly<Record<string, JbhPresentation>> =
  Object.freeze({
    "body-wave-human-hair-bundles": {
      name: "Lawless Body Wave Bundles",
      category: "Bundles",
      tagline: "Soft body-wave movement with natural shine.",
      description:
        "100% virgin human hair with soft body-wave movement and machine double-stitched wefts. Choose your length using live availability at checkout.",
      image: "/products/bundle-bodywave.jpg",
      allowedOptions: ['14"', '16"', '18"', '20"', '22"', '24"', '26"'],
    },
    "deep-wave-human-hair-bundles": {
      name: "Lawless Deep Wave Bundles",
      category: "Bundles",
      tagline: "Defined deep waves with full movement.",
      description:
        "100% virgin human hair with a defined deep-wave texture and machine double-stitched wefts. Choose your length using live availability at checkout.",
      image: "/products/bundle-deepwave.jpg",
      allowedOptions: ['14"', '18"', '22"', '26"'],
    },
    "loose-wave-human-hair-bundles": {
      name: "Lawless Loose Wave Bundles",
      category: "Bundles",
      tagline: "Soft loose waves with easy movement.",
      description:
        "100% virgin human hair with a soft loose-wave texture and machine double-stitched wefts. Choose your length using live availability at checkout.",
      image: "/products/bundle-loosewave.jpg",
      allowedOptions: ['14"', '18"', '22"', '26"'],
    },
    "kinky-straight-human-hair-bundles": {
      name: "Flawless Kinky Straight Bundles",
      category: "Bundles",
      tagline: "Full, textured straight hair with a natural blown-out finish.",
      description:
        "100% virgin human hair with a kinky-straight texture and machine double-stitched wefts. Choose your length using live availability at checkout.",
      image: "/products/bundle-kinkystraight.jpg",
      allowedOptions: ['14"', '18"', '22"', '26"'],
    },
  });

function isStoreVariant(value: unknown): value is StoreVariant {
  if (!value || typeof value !== "object") return false;
  const variant = value as Partial<StoreVariant>;
  return (
    typeof variant.id === "string" &&
    /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant.id) &&
    typeof variant.option === "string" &&
    typeof variant.price === "number" &&
    Number.isFinite(variant.price) &&
    variant.price > 0 &&
    typeof variant.availableForSale === "boolean"
  );
}

function isStoreProduct(value: unknown): value is StoreProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<StoreProduct>;
  return (
    typeof product.id === "string" &&
    typeof product.shopifyProductId === "string" &&
    /^gid:\/\/shopify\/Product\/\d+$/.test(product.shopifyProductId) &&
    typeof product.name === "string" &&
    typeof product.category === "string" &&
    typeof product.tagline === "string" &&
    typeof product.description === "string" &&
    typeof product.image === "string" &&
    typeof product.availableForSale === "boolean" &&
    Array.isArray(product.variants) &&
    product.variants.length > 0 &&
    product.variants.every(isStoreVariant)
  );
}

export function applyJbhPresentation(product: StoreProduct): StoreProduct | null {
  const presentation = JBH_PRESENTATION_BY_HANDLE[product.id];
  if (!presentation) return null;

  const variants = product.variants.filter((variant) =>
    presentation.allowedOptions.includes(variant.option),
  );
  if (variants.length === 0) return null;

  const { allowedOptions: _allowedOptions, ...publicPresentation } = presentation;
  return {
    ...product,
    ...publicPresentation,
    variants,
    availableForSale:
      product.availableForSale && variants.some((variant) => variant.availableForSale),
  };
}

export async function fetchShopifyCatalog(): Promise<StoreProduct[]> {
  const response = await fetch("/api/shopify/catalog", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as CatalogPayload;
  if (!response.ok || !Array.isArray(payload.products)) {
    throw new Error("Live inventory is temporarily unavailable.");
  }

  const products = payload.products
    .filter(isStoreProduct)
    .map(applyJbhPresentation)
    .filter((product): product is StoreProduct => product !== null);

  if (products.length === 0) {
    throw new Error("No approved JBH products are available right now.");
  }
  return products;
}

export function useShopifyCatalog() {
  return useQuery({
    queryKey: ["shopify", "catalog", SHOPIFY_PUBLIC_CONTRACT.shopDomain],
    queryFn: fetchShopifyCatalog,
    staleTime: 30_000,
    retry: 1,
  });
}

export function assertApprovedShopifyCheckoutRedirect(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("Checkout did not return a valid Shopify URL.");
  }

  let checkout: URL;
  try {
    checkout = new URL(rawUrl.trim());
  } catch {
    throw new Error("Checkout returned a malformed Shopify URL.");
  }

  if (
    checkout.protocol !== "https:" ||
    !SHOPIFY_PUBLIC_CONTRACT.checkoutHosts.includes(
      checkout.hostname as (typeof SHOPIFY_PUBLIC_CONTRACT.checkoutHosts)[number],
    ) ||
    checkout.username ||
    checkout.password ||
    checkout.port
  ) {
    throw new Error("Checkout redirect was blocked because the Shopify host was not approved.");
  }

  return checkout.toString();
}
