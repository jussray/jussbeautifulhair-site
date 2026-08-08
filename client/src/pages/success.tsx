import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import {
  getCheckoutSessionId,
  isPaidCheckoutVerification,
} from "@/lib/checkoutSuccess";

type VerificationState = "verifying" | "paid" | "not-paid" | "error";

/**
 * Stripe success_url is: https://domain.com/#/success?session_id={CHECKOUT_SESSION_ID}
 *
 * The session id in the URL is only a reference. The browser must ask the
 * Worker to retrieve that Checkout Session from Stripe before showing a paid
 * confirmation or clearing the cart.
 */
export default function SuccessPage() {
  const search = useSearch();
  const { clear } = useCart();
  const clearedRef = useRef(false);
  const [verification, setVerification] =
    useState<VerificationState>("verifying");
  const sessionId = getCheckoutSessionId(
    search,
    typeof window === "undefined" ? "" : window.location.hash,
  );

  useEffect(() => {
    if (!sessionId) {
      setVerification("not-paid");
      return;
    }

    const controller = new AbortController();

    async function verifyPayment() {
      setVerification("verifying");

      try {
        const response = await fetch(
          `/api/checkout/session/${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body: unknown = await response.json().catch(() => undefined);

        if (!response.ok || !isPaidCheckoutVerification(body)) {
          setVerification("not-paid");
          return;
        }

        if (!clearedRef.current) {
          clearedRef.current = true;
          clear();
        }
        setVerification("paid");
      } catch {
        if (!controller.signal.aborted) setVerification("error");
      }
    }

    void verifyPayment();
    return () => controller.abort();
  }, [clear, sessionId]);

  const paid = verification === "paid";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center space-y-5 shadow-sm">
        {paid && (
          <div className="flex justify-center">
            <CheckCircle2
              className="w-14 h-14 text-green-500"
              strokeWidth={1.5}
            />
          </div>
        )}

        <div className="space-y-2">
          {verification === "verifying" && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Verifying payment…
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We&rsquo;re checking this Checkout Session with Stripe before
                confirming the order.
              </p>
            </>
          )}

          {paid && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Order confirmed!
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Stripe confirmed the payment. Your order can now move into
                processing.
              </p>
            </>
          )}

          {verification === "not-paid" && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Payment not confirmed
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We could not verify a completed paid Checkout Session. Your cart
                has not been cleared.
              </p>
            </>
          )}

          {verification === "error" && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Verification unavailable
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We could not reach the payment verification service. Your cart
                has not been cleared, so you can safely retry.
              </p>
            </>
          )}
        </div>

        {paid && sessionId && (
          <p className="text-xs text-muted-foreground">
            Checkout ref:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
              {sessionId.slice(-12)}
            </code>
          </p>
        )}

        {paid ? (
          <Link href="/shop">
            <Button className="w-full" size="lg">
              Keep shopping
            </Button>
          </Link>
        ) : (
          <div className="space-y-2">
            <Link href="/cart">
              <Button className="w-full" size="lg">
                Return to cart
              </Button>
            </Link>
            {verification === "error" && (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Retry verification
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
