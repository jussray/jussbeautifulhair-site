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
    "lawless-bone-straight-bundle-raw-vietnamese": {
      name: "Lawless Bone Straight Bundle — Raw Vietnamese",
      category: "Bundles",
      tagline: "Silky raw Vietnamese hair with a glass-straight finish.",
      description:
        "Single-donor raw Vietnamese hair designed to press sleek, hold a curl, and move naturally with proper care.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/bundle-bonestraight_c3cba4a7-475e-49ab-85cf-b755cd51811a.jpg?v=1786301922",
      allowedOptions: ['14"', '18"', '22"', '26"'],
    },
    "royal-raw-indian-temple-bundle": {
      name: "Royal Raw Indian Temple Bundle",
      category: "Bundles",
      tagline: "Single-donor raw Indian hair with natural longevity.",
      description:
        "Cuticle-aligned raw Indian temple hair designed for long wear and flexible styling with proper care.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/bundle-royal-indian_71d3c68e-5c90-4ed1-96df-45438bd72023.jpg?v=1786301908",
      allowedOptions: ['14"', '18"', '22"', '26"'],
    },
    "lawless-4-4-hd-lace-closure": {
      name: "Lawless 4×4 HD Lace Closure",
      category: "Closures & Frontals",
      tagline: "Compact HD lace coverage for a polished install.",
      description:
        "Pre-plucked 4×4 HD lace closure with a natural-looking hairline and flexible everyday styling.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/closure-4x4_a62fc0d2-fa67-4242-a32f-34063047629d.jpg?v=1786301899",
      allowedOptions: ['16"'],
    },
    "lawless-5-5-hd-lace-closure": {
      name: "Lawless 5×5 HD Lace Closure",
      category: "Closures & Frontals",
      tagline: "More parting space with a seamless HD lace finish.",
      description:
        "5×5 HD lace closure with added parting room for a natural-looking install and versatile styling.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/closure-5x5_4b3b1278-8c14-4402-b946-baf4c15d2246.jpg?v=1786301890",
      allowedOptions: ['16"'],
    },
    "lawless-13-4-hd-lace-frontal": {
      name: "Lawless 13×4 HD Lace Frontal",
      category: "Closures & Frontals",
      tagline: "Ear-to-ear HD lace with flexible parting.",
      description:
        "13×4 HD lace frontal designed for broad hairline coverage, flexible parting, and a natural-looking finish.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/frontal-13x4_5bfa907a-f1c2-46fe-a494-10f12ac4d548.jpg?v=1786301839",
      allowedOptions: ['18"'],
    },
    "flawless-13-6-body-wave-bob-wig": {
      name: "Flawless 13×6 Body Wave Bob Wig",
      category: "Wigs",
      tagline: "Glossy body-wave movement in a polished bob.",
      description:
        "10-inch body-wave bob with 13×6 HD transparent lace and a pre-plucked finish for an easy polished look.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/wig-13x6-bob_3499d848-53a9-4172-8617-d91cb1932053.jpg?v=1786301818",
      allowedOptions: ['10" bob'],
    },
    "flawless-deep-wave-u-part-wig": {
      name: "Flawless Deep Wave U-Part Wig",
      category: "Wigs",
      tagline: "Beginner-friendly deep wave with leave-out flexibility.",
      description:
        "20-inch deep-wave U-part construction designed for a quick protective install while blending with your natural leave-out.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/wig-upart-deepwave_696eed72-90e8-4102-b617-7fa9216f94b7.jpg?v=1786301808",
      allowedOptions: ['20"'],
    },
    "flawless-13-4-lace-frontal-wig-straight": {
      name: "Flawless 13×4 Lace Frontal Wig — Straight",
      category: "Wigs",
      tagline: "Sleek straight styling with a ready-to-wear lace finish.",
      description:
        "22-inch straight human-hair wig with 13×4 lace, a pre-plucked hairline, and a ready-to-wear finish.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/wig-13x4-straight_9f4c2d88-b645-4090-bd13-1603733e68b2.jpg?v=1786301824",
      allowedOptions: ['22"'],
    },
    "flawless-glueless-4-4-closure-wig-body-wave": {
      name: "Flawless Glueless 4×4 Closure Wig — Body Wave",
      category: "Wigs",
      tagline: "Glueless body-wave styling with an adjustable fit.",
      description:
        "18-inch body-wave closure wig with adjustable straps, combs, and a breathable cap for an easy glueless install.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/wig-glueless-bodywave_7ee33b84-52db-4ef5-9911-e4cb60c2d142.jpg?v=1786301864",
      allowedOptions: ['18"'],
    },
    "lawless-edge-control-4-oz": {
      name: "Lawless Edge Control — 4 oz",
      category: "Beauty Essentials",
      tagline: "Strong, polished hold for everyday styling.",
      description:
        "4 oz edge control designed for smooth styling and firm hold without a flaky finish.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/edge-control_18dc1db5-8a31-403b-b3b7-7c6751359a57.jpg?v=1786301802",
      allowedOptions: ["4 oz"],
    },
    "lawless-lace-melt-spray": {
      name: "Lawless Lace Melt Spray",
      category: "Beauty Essentials",
      tagline: "A clean finishing step for lace installs.",
      description:
        "2 oz lace melt spray designed for HD and Swiss lace installs and a smooth finished look.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/lace-melt-spray_082f9766-685a-4d0f-a1dd-4831988e0678.jpg?v=1786301882",
      allowedOptions: ["2 oz"],
    },
    "lawless-hair-oil-rosemary-mint": {
      name: "Lawless Hair Oil — Rosemary Mint",
      category: "Beauty Essentials",
      tagline: "Lightweight scalp care for natural hair and installs.",
      description:
        "2 oz rosemary, mint, and castor scalp oil designed for lightweight care with natural hair and protective installs.",
      image:
        "https://cdn.shopify.com/s/files/1/0845/7604/3251/files/hair-oil_66810ed7-a883-4113-8c21-934002c3b41d.jpg?v=1786301875",
      allowedOptions: ["2 oz"],
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

  const checkoutHost = checkout.hostname.toLowerCase();
  if (
    checkout.protocol !== "https:" ||
    !SHOPIFY_PUBLIC_CONTRACT.checkoutHosts.includes(
      checkoutHost as (typeof SHOPIFY_PUBLIC_CONTRACT.checkoutHosts)[number],
    ) ||
    checkout.username ||
    checkout.password ||
    checkout.port
  ) {
    throw new Error("Checkout redirect was blocked because the Shopify host was not approved.");
  }

  // Shopify may return the branded storefront host for Cart checkoutUrl. That host
  // is owned by the Cloudflare SPA, so sending /cart/c/* there loops back into the
  // storefront. Preserve Shopify's exact cart path and key while escaping only the
  // colliding hostname to the canonical shop domain that serves Shopify checkout.
  if (checkoutHost === "jussbeautifulhair.com") {
    checkout.hostname = SHOPIFY_PUBLIC_CONTRACT.shopDomain;
  }

  return checkout.toString();
}
