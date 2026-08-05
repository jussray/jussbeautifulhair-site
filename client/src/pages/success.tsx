import { useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { getCheckoutSessionId } from "@/lib/checkoutSuccess";

/**
 * Stripe success_url is: https://domain.com/#/success?session_id={CHECKOUT_SESSION_ID}
 *
 * In hash-router mode, wouter's useSearch() returns the query string that
 * follows the hash path. Browsers can also leave the query inside
 * window.location.hash, so the parser supports both forms.
 */
export default function SuccessPage() {
  const search = useSearch();
  const { clear } = useCart();
  const clearedRef = useRef(false);
  const sessionId = getCheckoutSessionId(
    search,
    typeof window === "undefined" ? "" : window.location.hash,
  );

  useEffect(() => {
    if (!clearedRef.current) {
      clearedRef.current = true;
      clear();
    }
  }, [clear]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center space-y-5 shadow-sm">
        <div className="flex justify-center">
          <CheckCircle2 className="w-14 h-14 text-green-500" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Order confirmed!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Thank you for shopping with Juss Beautiful Hair. A confirmation
            email is on its way and we&rsquo;ll keep you updated as your order ships.
          </p>
        </div>
        {sessionId && (
          <p className="text-xs text-muted-foreground">
            Order ref:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
              {sessionId.slice(-12)}
            </code>
          </p>
        )}
        <Link href="/shop">
          <Button className="w-full" size="lg">
            Keep shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
