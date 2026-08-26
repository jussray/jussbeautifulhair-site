import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, ShoppingBag, Truck, ShieldCheck, RotateCcw, Minus, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import { useShopifyCatalog } from "@/lib/shopifyCatalog";

export default function Product() {
  const [, params] = useRoute("/product/:id");
  const {
    data: products = [],
    isLoading,
    isError,
    isRefetchError,
    refetch,
  } = useShopifyCatalog();
  const catalogUnavailable = isError || isRefetchError;
  const product = params ? products.find((candidate) => candidate.id === params.id) : undefined;
  const { addItem } = useCart();
  const { toast } = useToast();
  const [variantIdx, setVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    const firstAvailable = product.variants.findIndex((variant) => variant.availableForSale);
    setVariantIdx(firstAvailable >= 0 ? firstAvailable : 0);
    setQty(1);
  }, [product?.id]);

  const related = useMemo(
    () =>
      product
        ? products
            .filter(
              (candidate) =>
                candidate.category === product.category && candidate.id !== product.id,
            )
            .slice(0, 4)
        : [],
    [product, products],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-6 py-10 grid md:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-square rounded-lg bg-muted" />
          <div className="space-y-5 py-4">
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-10 w-3/4 rounded bg-muted" />
            <div className="h-6 w-1/3 rounded bg-muted" />
            <div className="h-24 rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (catalogUnavailable) {
    return (
      <Layout>
        <div
          className="mx-auto max-w-3xl px-6 py-24 text-center"
          data-testid="product-catalog-unavailable"
        >
          <h1 className="font-display text-3xl text-foreground">Live product details are refreshing</h1>
          <p className="mt-3 text-muted-foreground">We are not showing stale pricing or availability.</p>
          <Button
            className="mt-6"
            onClick={() => void refetch()}
            data-testid="button-product-catalog-retry"
          >
            Try Again
          </Button>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl text-foreground">Product not found</h1>
          <Link href="/shop">
            <Button className="mt-6">Back to Shop</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const variant = product.variants[variantIdx] || product.variants[0];
  const canAdd = product.availableForSale && variant.availableForSale;

  const add = () => {
    if (!canAdd) return;
    addItem(
      {
        id: product.id,
        variantId: variant.id,
        name: product.name,
        variant: variant.option,
        price: variant.price,
        image: product.image,
      },
      qty,
    );
    toast({
      title: "Added to cart 💜",
      description: `${qty} × ${product.name} (${variant.option})`,
    });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/shop"
          data-testid="link-back-shop"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Shop
        </Link>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
          <div className="rounded-lg overflow-hidden bg-muted border border-card-border">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                data-testid="img-product"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square grid place-items-center text-muted-foreground">
                Product image updating
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold mb-2">
              {product.category}
            </p>
            <h1
              data-testid="text-product-name"
              className="font-display text-3xl sm:text-4xl text-foreground leading-tight"
            >
              {product.name}
            </h1>
            {product.tagline && (
              <p className="mt-3 text-lg text-muted-foreground italic">{product.tagline}</p>
            )}

            <p
              data-testid="text-product-price"
              className="mt-5 text-3xl font-semibold text-foreground"
            >
              {formatPrice(variant.price)}
            </p>

            <p className="mt-6 text-foreground/80 leading-relaxed">
              {product.description}
            </p>

            {product.variants.length > 1 && (
              <div className="mt-8">
                <p className="text-sm font-medium text-foreground mb-3">Length / Option</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      onClick={() => candidate.availableForSale && setVariantIdx(index)}
                      disabled={!candidate.availableForSale}
                      data-testid={`variant-${index}`}
                      className={`min-w-[3.5rem] px-3 py-2 rounded-md border text-sm transition-colors ${
                        variantIdx === index
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {candidate.option}
                      {!candidate.availableForSale ? " · Sold out" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <p className="text-sm font-medium text-foreground mb-3">Quantity</p>
              <div className="inline-flex items-center rounded-md border border-border bg-card">
                <button
                  onClick={() => setQty((current) => Math.max(1, current - 1))}
                  data-testid="button-qty-minus"
                  className="h-10 w-10 inline-flex items-center justify-center text-foreground hover-elevate rounded-l-md"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span data-testid="text-qty" className="w-12 text-center text-sm font-medium">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((current) => Math.min(10, current + 1))}
                  data-testid="button-qty-plus"
                  className="h-10 w-10 inline-flex items-center justify-center text-foreground hover-elevate rounded-r-md"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Button
              size="lg"
              onClick={add}
              disabled={!canAdd}
              data-testid="button-add-to-cart"
              className="mt-8 w-full sm:w-auto font-semibold"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {canAdd ? `Add to Cart — ${formatPrice(variant.price * qty)}` : "Currently Sold Out"}
            </Button>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border pt-6">
              <div className="flex items-start gap-2.5 text-sm">
                <Truck className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">Live availability synced through Shopify.</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">Secure checkout powered by Shopify.</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <RotateCcw className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">Shipping and returns follow current store policies.</span>
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display text-2xl text-foreground mb-6">You may also love</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((candidate) => (
                <ProductCard key={candidate.id} product={candidate} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="md:hidden sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground truncate">{product.name}</p>
          <p className="text-base font-semibold text-foreground">{formatPrice(variant.price * qty)}</p>
        </div>
        <Button
          onClick={add}
          disabled={!canAdd}
          data-testid="button-add-to-cart-mobile"
          className="font-semibold"
        >
          <ShoppingBag className="mr-2 h-4 w-4" /> {canAdd ? "Add to Cart" : "Sold Out"}
        </Button>
      </div>
    </Layout>
  );
}
