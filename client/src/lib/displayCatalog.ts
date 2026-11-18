import { FEATURED_IDS, PRODUCTS } from "./catalog";
import type { Product } from "./catalog";

// Display-only projection of the static JBH catalog (shared/catalog.ts).
//
// This shape exists for exactly one situation: the live Shopify catalog
// fetch failed, so the storefront would otherwise show no products at all.
// It is deliberately NOT a StoreProduct:
// - no Shopify product or variant IDs exist here, so nothing in this shape
//   can satisfy the cart's Shopify variant-ID guard or be handed to
//   addItem / checkout;
// - there is no availability field, so no stock or availability claim can
//   be rendered from it;
// - prices and options are the static catalog's own published values,
//   shown for browsing only until live inventory is verified again.
export interface DisplayOnlyOption {
  option: string;
  price: number;
}

export interface DisplayOnlyProduct {
  kind: "display-only";
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  image: string;
  badge?: string;
  options: DisplayOnlyOption[];
}

function toDisplayOnlyProduct(product: Product): DisplayOnlyProduct {
  return {
    kind: "display-only",
    id: product.id,
    name: product.name,
    category: product.category,
    tagline: product.tagline,
    description: product.description,
    image: product.image,
    badge: product.badge,
    options: product.variants.map((variant) => ({
      option: variant.option,
      price: variant.price,
    })),
  };
}

export const DISPLAY_ONLY_PRODUCTS: DisplayOnlyProduct[] = PRODUCTS.map(toDisplayOnlyProduct);

export const DISPLAY_ONLY_FEATURED: DisplayOnlyProduct[] = FEATURED_IDS.map((id) =>
  DISPLAY_ONLY_PRODUCTS.find((product) => product.id === id),
).filter((product): product is DisplayOnlyProduct => product !== undefined);
