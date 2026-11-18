import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog";
import { useSaleCatalog } from "@/lib/saleCatalog";

export default function Shop() {
  const [active, setActive] = useState("All");
  const { data: products = [], isLoading, isError, refetch } = useSaleCatalog();

  const categories = useMemo(
    () =>
      CATEGORIES.filter(
        (category) =>
          category === "All" || products.some((product) => product.category === category),
      ),
    [products],
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
          <h1 className="font-display text-4xl sm:text-5xl">All Products</h1>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
            Shop our approved collection with secure Stripe checkout.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {!isError && (
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActive(category)}
                data-testid={`filter-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  active === category
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-primary"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Loading approved collection">
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
            <h2 className="font-display text-2xl text-foreground">Collection temporarily unavailable</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              No items are offered until availability and pricing are approved.
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
