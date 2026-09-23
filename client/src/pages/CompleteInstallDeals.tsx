import { useMemo } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useShopifyCatalog } from "@/lib/shopifyCatalog";

const COMPLETE_INSTALL_HANDLES = new Set([
  "body-wave-human-hair-bundle-deal",
  "straight-human-hair-bundle-deal",
  "deep-wave-human-hair-bundle-deal",
  "loose-wave-human-hair-bundle-deal",
]);

export default function CompleteInstallDeals() {
  const { data: products = [], isLoading, isError, refetch } = useShopifyCatalog();

  const deals = useMemo(
    () => products.filter((product) => COMPLETE_INSTALL_HANDLES.has(product.id)),
    [products],
  );

  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">
            Complete Install Bundle Deals
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">Three Bundles. One Choice.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/80">
            Choose Body Wave, Straight, Deep Wave, or Loose Wave, then pick the graduated
            length set that matches your finished look. Pricing and availability come live
            from Shopify.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading && (
          <div
            className="grid grid-cols-2 gap-5 lg:grid-cols-4"
            aria-label="Loading complete install bundle deals"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-lg border border-card-border bg-card"
              >
                <div className="aspect-square bg-muted" />
                <div className="space-y-3 p-4">
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
            <h2 className="font-display text-2xl text-foreground">Live bundle deals are refreshing</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We could not load Shopify inventory just now. No stale prices are being shown.
            </p>
            <Button
              className="mt-6"
              onClick={() => void refetch()}
              data-testid="button-retry-complete-install"
            >
              Try Again
            </Button>
          </div>
        )}

        {!isLoading && !isError && deals.length === 0 && (
          <div className="mx-auto max-w-xl rounded-lg border border-card-border bg-card px-6 py-10 text-center">
            <h2 className="font-display text-2xl text-foreground">Bundle deals are updating</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              No approved Complete Install deal is available on the storefront right now.
            </p>
          </div>
        )}

        {!isLoading && !isError && deals.length > 0 && (
          <>
            <p className="mb-6 text-sm text-muted-foreground" data-testid="text-complete-install-count">
              {deals.length} complete-install {deals.length === 1 ? "option" : "options"}
            </p>
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}

        <div className="mt-12 rounded-lg border border-card-border bg-card px-6 py-8 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Still deciding?</p>
          <h2 className="mt-2 font-display text-2xl text-foreground">Start with Juss Hair Match</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Use the separate Hair Match flow for personalized texture and length recommendations.
          </p>
          <Link
            href="/hair-match"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            data-testid="link-complete-install-hair-match"
          >
            Start Hair Match
          </Link>
        </div>
      </div>
    </Layout>
  );
}
