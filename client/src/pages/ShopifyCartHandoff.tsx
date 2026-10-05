import { useEffect, useMemo } from "react";
import { ExternalLink, LoaderCircle, ShoppingBag } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { SHOPIFY_PUBLIC_CONTRACT } from "@/lib/shopifyCatalog";

export function buildShopifyCartHandoffUrl(
  pathname: string,
  search: string,
): string {
  const safePath = pathname.startsWith("/cart/c/") ? pathname : "/cart";
  const target = new URL(`https://${SHOPIFY_PUBLIC_CONTRACT.shopDomain}`);
  target.pathname = safePath;
  target.search = search;
  return target.toString();
}

export default function ShopifyCartHandoff() {
  const checkoutUrl = useMemo(
    () => buildShopifyCartHandoffUrl(window.location.pathname, window.location.search),
    [],
  );

  useEffect(() => {
    window.location.replace(checkoutUrl);
  }, [checkoutUrl]);

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.28em] text-gold">Secure Checkout</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl text-foreground">
          Taking you to Shopify checkout
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Your cart is ready. We are handing this checkout to Shopify so payment and order state stay with the store's secure commerce provider.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Redirecting securely
        </div>

        <a href={checkoutUrl} className="mt-8 inline-block" data-testid="link-shopify-cart-handoff">
          <Button size="lg" className="font-semibold">
            Continue to secure checkout <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </section>
    </Layout>
  );
}
