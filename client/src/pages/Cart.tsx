import { Link } from "wouter";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";

export default function Cart() {
  const { items, updateQty, removeItem, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40 text-primary mb-6">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl text-foreground">Your cart is empty</h1>
          <p className="mt-3 text-muted-foreground">Time to find something flawless.</p>
          <Link href="/shop">
            <Button size="lg" className="mt-6 font-semibold" data-testid="button-shop-empty">
              Shop Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-8">Your Cart</h1>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.variantId}
                data-testid={`row-cart-${item.id}`}
                className="flex gap-4 rounded-lg border border-card-border bg-card p-4"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-24 w-24 rounded-md object-cover bg-muted shrink-0"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-md bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base text-foreground leading-snug">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.variant}</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{formatPrice(item.price)}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-md border border-border">
                      <button
                        onClick={() => updateQty(item.variantId, item.qty - 1)}
                        data-testid={`button-dec-${item.id}`}
                        className="h-8 w-8 inline-flex items-center justify-center hover-elevate rounded-l-md"
                        aria-label="Decrease"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.variantId, item.qty + 1)}
                        data-testid={`button-inc-${item.id}`}
                        className="h-8 w-8 inline-flex items-center justify-center hover-elevate rounded-r-md"
                        aria-label="Increase"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      data-testid={`button-remove-${item.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{formatPrice(item.price * item.qty)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-lg border border-card-border bg-card p-6 sticky top-28">
              <h2 className="font-display text-xl text-foreground mb-4">Order Summary</h2>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current subtotal</span>
                <span data-testid="text-subtotal" className="text-foreground font-medium">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Shopify confirms current item availability, shipping, discounts, and taxes before payment.
              </p>
              <Link href="/checkout">
                <Button
                  size="lg"
                  className="mt-6 w-full font-semibold"
                  data-testid="button-checkout"
                >
                  Checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/shop">
                <Button variant="ghost" className="mt-2 w-full" data-testid="button-continue">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
