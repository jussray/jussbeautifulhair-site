import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Layout } from "@/components/Layout";

const orderIdPattern = /^jbho_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = "checking" | "pending" | "paid" | "review" | "unavailable";

export default function JussPaySuccess() {
  const order = new URLSearchParams(useSearch()).get("order") ?? "";
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<Result>("checking");

  useEffect(() => {
    if (!orderIdPattern.test(order)) { setResult("unavailable"); return; }
    const controller = new AbortController();
    setResult("checking");
    void (async () => {
      try {
        const response = await fetch("/api/jusspay/orders/" + encodeURIComponent(order), {
          cache: "no-store", signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        const state = body?.state;
        setResult(response.ok && (state === "paid" || state === "pending" || state === "review") ? state : "unavailable");
      } catch { if (!controller.signal.aborted) setResult("unavailable"); }
    })();
    return () => controller.abort();
  }, [attempt, order]);

  const content = {
    checking: ["Checking your order", "We’re waiting for a verified payment update."],
    paid: ["Payment confirmed", "Your payment has been verified. This does not mean your order has shipped."],
    pending: ["Payment is still being verified", "Check again in a moment. Don’t submit another payment while this order is processing."],
    review: ["This order needs review", "Contact Juss Beautiful Hair before making another payment."],
    unavailable: ["We couldn’t verify your payment", "Check your Stripe receipt or contact Juss Beautiful Hair before trying to pay again."],
  }[result];

  return (
    <Layout>
      <section className="mx-auto max-w-xl px-6 py-20 text-center">
        <div role="status" aria-live="polite">
          <h1 className="font-display text-3xl text-foreground">{content[0]}</h1>
          <p className="mt-4 text-muted-foreground">{content[1]}</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-5">
          {(result === "pending" || result === "unavailable") && orderIdPattern.test(order) && (
            <button className="font-semibold underline" onClick={() => retry((previous) => previous + 1)}>Check payment status</button>
          )}
          <Link href={result === "paid" ? "/shop" : "/contact"} className="font-semibold underline">
            {result === "paid" ? "Continue shopping" : "Contact us"}
          </Link>
        </div>
      </section>
    </Layout>
  );
}
