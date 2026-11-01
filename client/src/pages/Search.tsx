import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useShopifyCatalog } from "@/lib/shopifyCatalog";

function initialQuery(): string {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("q") || "").slice(0, 100);
}

export default function Search() {
  const [query, setQuery] = useState(initialQuery);
  const { data: products = [], isLoading, isError, refetch } = useShopifyCatalog();
  const term = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      term
        ? products.filter((product) =>
            [product.name, product.category, product.description]
              .some((value) => value.toLocaleLowerCase().includes(term)),
          )
        : products,
    [products, term],
  );

  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Find Your Hair</p>
          <h1 className="font-display text-4xl sm:text-5xl">Search the Store</h1>
          <p className="mt-4 text-primary-foreground/80">Search products from our approved Shopify catalog.</p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <form role="search" method="get" action="/search" className="mx-auto max-w-2xl">
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="jbh-search-query">Search products</label>
          <div className="flex gap-3">
            <input
              id="jbh-search-query"
              name="q"
              type="search"
              maxLength={100}
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try body wave, wig, or closure"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-3 text-foreground"
            />
            <Button type="submit">Search</Button>
          </div>
        </form>

        {isLoading && <p className="mt-10 text-center text-muted-foreground" role="status">Loading live products…</p>}
        {isError && (
          <div className="mx-auto mt-10 max-w-xl rounded-lg border border-card-border bg-card px-6 py-10 text-center" role="alert">
            <h2 className="font-display text-xl">Search is temporarily unavailable</h2>
            <p className="mt-3 text-muted-foreground">We could not verify the live Shopify catalog. No unverified prices are shown.</p>
            <Button className="mt-5" onClick={() => void refetch()}>Try Again</Button>
          </div>
        )}
        {!isLoading && !isError && (
          <div className="mt-10">
            <p className="mb-6 text-sm text-muted-foreground" role="status" data-testid="search-result-count">
              {matches.length} {matches.length === 1 ? "product" : "products"} {term ? "matching your search" : "available in the catalog"}
            </p>
            {matches.length === 0 && (
              <div data-testid="search-empty-state" className="mx-auto max-w-xl rounded-lg border border-card-border bg-card px-6 py-10 text-center">
                <h2 className="font-display text-xl">No matching products</h2>
                <p className="mt-3 text-muted-foreground">Try another texture, length, or product type.</p>
                <Link href="/shop" className="mt-4 inline-block text-primary underline">Browse all products</Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {matches.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
