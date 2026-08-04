import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  createHairMatchCheckout,
  type ShopifyCartAttribute,
} from "@/lib/shopifyStorefront";

const SELECT_CLASS =
  "mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function HairMatch() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hairGoal, setHairGoal] = useState("not-sure");
  const [preferredLength, setPreferredLength] = useState("not-sure");
  const [budget, setBudget] = useState("not-sure");
  const [maintenance, setMaintenance] = useState("low-maintenance");

  function startCheckout() {
    const preferences: ShopifyCartAttribute[] = [
      { key: "hair_goal", value: hairGoal },
      { key: "preferred_length", value: preferredLength },
      { key: "budget", value: budget },
      { key: "maintenance", value: maintenance },
    ];

    setSubmitting(true);
    setError(null);

    try {
      const { checkoutUrl } = createHairMatchCheckout(preferences);
      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout could not be started. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <section className="overflow-hidden rounded-3xl border border-card-border bg-card shadow-sm">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Founding Client Offer
              </div>

              <h1 className="mt-6 font-display text-4xl leading-tight text-foreground sm:text-5xl">
                Juss Hair Match Session
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Get a personal recommendation for texture, length, lace, bundles,
                or wigs based on your look, budget, and maintenance preferences.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Texture and length guidance",
                  "Wig, bundle, closure, or frontal recommendation",
                  "Budget and maintenance guidance",
                  "$25 credit toward an eligible future JBH order",
                  "Early access to approved supplier selections",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-foreground/85">{benefit}</span>
                  </div>
                ))}
              </div>

              <fieldset className="mt-10 border-t border-border pt-8">
                <legend className="font-display text-xl text-foreground">
                  Give Juss a head start
                </legend>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Choose what fits today. “Not sure yet” is always okay.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-foreground">
                    What are you considering?
                    <select
                      className={SELECT_CLASS}
                      value={hairGoal}
                      onChange={(event) => setHairGoal(event.target.value)}
                      data-testid="select-hair-goal"
                    >
                      <option value="not-sure">Not sure yet</option>
                      <option value="wig">Wig</option>
                      <option value="bundles">Bundles</option>
                      <option value="closure-frontal">Closure or frontal</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium text-foreground">
                    Preferred length
                    <select
                      className={SELECT_CLASS}
                      value={preferredLength}
                      onChange={(event) => setPreferredLength(event.target.value)}
                      data-testid="select-preferred-length"
                    >
                      <option value="not-sure">Not sure yet</option>
                      <option value="short-10-14">Short · 10–14 inches</option>
                      <option value="medium-16-20">Medium · 16–20 inches</option>
                      <option value="long-22-plus">Long · 22+ inches</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium text-foreground">
                    Future-order budget
                    <select
                      className={SELECT_CLASS}
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      data-testid="select-budget"
                    >
                      <option value="not-sure">Not sure yet</option>
                      <option value="under-150">Under $150</option>
                      <option value="150-250">$150–$250</option>
                      <option value="250-plus">$250+</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium text-foreground">
                    Maintenance preference
                    <select
                      className={SELECT_CLASS}
                      value={maintenance}
                      onChange={(event) => setMaintenance(event.target.value)}
                      data-testid="select-maintenance"
                    >
                      <option value="low-maintenance">Keep it low-maintenance</option>
                      <option value="flexible">I am flexible</option>
                      <option value="not-sure">Not sure yet</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            </div>

            <aside className="flex flex-col justify-center border-t border-card-border bg-secondary/20 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                One-time session
              </p>
              <p className="mt-3 font-display text-5xl text-foreground">$25</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The full $25 becomes purchase credit toward an eligible future Juss
                Beautiful Hair order.
              </p>

              <div className="mt-6 rounded-xl border border-card-border bg-background/80 p-4 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Important:</strong> This is a
                personalized consultation and future store credit. It is not an order
                for physical hair, and no hair product ships from this purchase.
              </div>

              {error && (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                size="lg"
                className="mt-6 w-full font-semibold"
                disabled={submitting}
                onClick={startCheckout}
                data-testid="button-hair-match-checkout"
              >
                {submitting ? "Opening secure checkout…" : "Reserve My Hair Match"}
                {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Secure checkout powered by Shopify
              </div>
            </aside>
          </div>
        </section>
      </main>
    </Layout>
  );
}
