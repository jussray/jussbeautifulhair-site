import { useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";

/**
 * Stripe success_url is: https://domain.com/#/success?session_id={CHECKOUT_SESSION_ID}
 *
 * In hash-router mode, wouter's useSearch() returns the query string that
 * follows the hash path (everything after "#/success"). Most browsers treat
 * "?" after "#" as part of the hash fragment, so window.location.search is
 * typically empty and window.location.hash contains the full fragment
 * including the query string. We try useSearch() first (wouter normalises
 * this correctly), then fall back to parsing window.location.hash directly.
 */
function getSessionId(): string | null {
  // Primary: wouter's useSearch — works when wouter parses hash query strings
  // (called inside the component so we can use the hook, but we also need a
  // standalone version for the fallback below — see component body).
  return null; // placeholder; real logic is in the component
}

export default function SuccessPage() {
  const search = useSearch();
  const { clear } = useCart();
  const clearedRef = useRef(false);

  // Resolve session_id from wouter's search string or from the raw hash
  const sessionId = (() => {
    // 1. Try wouter's normalised search string (e.g. "?session_id=cs_live_xxx")
    if (search) {
      const id = new URLSearchParams(search).get("session_id");
      if (id) return id;
    }
    // 2. Fallback: parse window.location.hash directly
    //    hash is something like "#/success?session_id=cs_live_xxx"
    try {
      const hashQuery = window.location.hash.split("?")[1] ?? "";
      const id = new URLSearchParams(hashQuery).get("session_id");
      if (id) return id;
    } catch {
      // not in a browser context (SSR/test) — ignore
    }
    return null;
  })();

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
