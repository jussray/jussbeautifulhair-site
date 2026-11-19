import { formatPrice } from "@/lib/catalog";
import type { DisplayOnlyProduct } from "@/lib/displayCatalog";

// Browsing-only card for the static collection, rendered solely when live
// Shopify inventory cannot be loaded. It has no link, no button, and no
// cart path by construction: DisplayOnlyProduct carries no Shopify variant
// ID the cart could accept, and this component never touches the cart.
export function DisplayProductCard({ product }: { product: DisplayOnlyProduct }) {
  const multi = product.options.length > 1;
  const fromPrice = Math.min(...product.options.map((option) => option.price));

  return (
    <article
      data-testid={`card-display-${product.id}`}
      className="block rounded-lg overflow-hidden bg-card border border-card-border"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full grid place-items-center px-6 text-center text-sm text-muted-foreground">
            Product image updating
          </div>
        )}
        {product.badge && (
          <span
            className={`absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full ${
              product.badge === "Signature"
                ? "bg-gold text-primary"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
          {product.category}
        </p>
        <h3 className="font-display text-base leading-snug text-foreground line-clamp-2 min-h-[2.6rem]">
          {product.name}
        </h3>
        <p className="mt-2 text-sm">
          <span className="font-semibold text-foreground">
            {multi ? "From " : ""}
            {formatPrice(fromPrice)}
          </span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {product.options.map((option) => `${option.option} · ${formatPrice(option.price)}`).join("  ")}
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Browsing only — ordering is paused
        </p>
      </div>
    </article>
  );
}
