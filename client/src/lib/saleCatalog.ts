import { useQuery } from "@tanstack/react-query";

/** First-party offers approved by the server, independent of Shopify. */
export interface StoreVariant {
  id: string;
  option: string;
  price: number;
  availableForSale: boolean;
}

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  variants: StoreVariant[];
  badge?: string;
  image: string;
  availableForSale: boolean;
}

function isVariant(value: unknown): value is StoreVariant {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<StoreVariant>;
  return (
    typeof v.id === "string" &&
    /^jbh:[a-z0-9-]+:\d+$/.test(v.id) &&
    typeof v.option === "string" && v.option.length > 0 &&
    typeof v.price === "number" && Number.isFinite(v.price) && v.price > 0 &&
    v.availableForSale === true
  );
}

function isProduct(value: unknown): value is StoreProduct {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<StoreProduct>;
  return (
    typeof p.id === "string" && /^[a-z0-9-]+$/.test(p.id) &&
    typeof p.name === "string" && p.name.length > 0 &&
    typeof p.category === "string" &&
    typeof p.tagline === "string" &&
    typeof p.description === "string" &&
    typeof p.image === "string" &&
    Array.isArray(p.variants) && p.variants.length > 0 &&
    p.variants.every(isVariant) &&
    p.availableForSale === true
  );
}

export async function fetchSaleCatalog(): Promise<StoreProduct[]> {
  const response = await fetch("/api/stripe/catalog", {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error("The collection is not open for orders yet.");
  }
  const data = payload as { source?: unknown; products?: unknown };
  if (data.source !== "jbh-approved-stripe-catalog" ||
      !Array.isArray(data.products) || !data.products.every(isProduct)) {
    throw new Error("The approved collection could not be verified.");
  }
  return data.products;
}

export function useSaleCatalog() {
  return useQuery({
    queryKey: ["jbh", "approved-stripe-catalog"],
    queryFn: fetchSaleCatalog,
    retry: false,
    staleTime: 30_000,
  });
}
