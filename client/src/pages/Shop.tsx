import { useMemo } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog";
import { useShopifyCatalog } from "@/lib/shopifyCatalog";

const CATEGORY_ROUTES: Record<string, string> = {
  All: "/shop",
  Bundles: "/shop/bundles",
  Wigs: "/shop/wigs",
  "Closures & Frontals": "/shop/closures-frontals",
  "Beauty Essentials": "/shop/beauty-essentials",
};

export default function Shop({ initialCategory = "All" }: { initialCategory?: string }) {
  const active = initialCategory;
  const { data: products = [], isLoading, isError, refetch } = useShopifyCatalog();

  const categories = useMemo(
    () =>
      CATEGORIES.filter(
        (category) =>
          category === "All" || category === active || products.some((product) => product.category === category),
      ),
    [active, products],
  );

  const filtered = useMemo(
    () =>
      active === "All"
        ? products
        : products.filter((product) => product.category === active),
    [active, products],
  );

  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-14 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            Shop the Collection
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">{active === "All" ? "All Products" : active}</h1>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
            Live hair and beauty inventory, with secure checkout powered by Shopify.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {!isError && (
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {categories.map((category) => (
              <Link
                key={category}
                href={CATEGORY_ROUTES[category] || "/shop"}
                aria-current={active === category ? "page" : undefined}
                data-testid={`filter-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  active === category
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-primary"
                }`}
              >
                {category}
              </Link>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Loading live inventory">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="rounded-lg border border-card-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-5 w-full rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="mx-auto max-w-xl rounded-lg border border-card-border bg-card px-6 py-10 text-center">
            <h2 className="font-display text-2xl text-foreground">Live inventory is refreshing</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We could not load Shopify inventory just now. No stale prices are being shown.
            </p>
            <Button className="mt-6" onClick={() => void refetch()} data-testid="button-retry-catalog">
              Try Again
            </Button>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <p className="text-sm text-muted-foreground mb-6" data-testid="text-result-count">
              {filtered.length} {filtered.length === 1 ? "product" : "products"}
            </p>
            {filtered.length === 0 && (
              <div data-testid="catalog-empty-state" role="status" className="mx-auto max-w-xl rounded-lg border border-card-border bg-card px-6 py-10 text-center">
                <h2 className="font-display text-2xl text-foreground">No products available here right now</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {active === "All"
                    ? "No products are currently available to order. Please check again later."
                    : "There are no available products in this category right now. Draft and unavailable items are not offered for checkout."}
                </p>
                {active !== "All" && (
                  <Link href="/shop" className="mt-6 inline-block text-primary underline">Browse all available products</Link>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
