import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
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
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <section className="overflow-hidden rounded-3xl border border-card-border bg-card shadow-sm">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Founding Client Offer</div>
              <h1 className="mt-6 font-display text-4xl leading-tight text-foreground sm:text-5xl">Juss Hair Match Session</h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">Get a personal recommendation for texture, length, lace, bundles, or wigs based on your look, budget, and maintenance preferences.</p>
              <div className="mt-8 space-y-4">
                {["Texture and length guidance","Wig, bundle, closure, or frontal recommendation","Budget and maintenance guidance","$25 credit toward an eligible future JBH order","Early access to approved supplier selections"].map((benefit)=>(<div key={benefit} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="text-foreground/85">{benefit}</span></div>))}
              </div>
              <fieldset className="mt-10 border-t border-border pt-8"><legend className="font-display text-xl text-foreground">Give Juss a head start</legend><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose what fits today. “Not sure yet” is always okay.</p></fieldset>
            </div>
            <aside className="flex flex-col justify-center border-t border-card-border bg-secondary/20 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">One-time session</p>
              <p className="mt-3 font-display text-5xl text-foreground">$25</p>
              {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
              <button className="mt-6" disabled={submitting} onClick={startCheckout}>{submitting ? "Opening secure checkout…" : "Reserve My Hair Match"}{!submitting && <ArrowRight className="ml-2 inline h-4 w-4" />}</button>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Secure checkout powered by Shopify</div>
            </aside>
          </div>
        </section>
      </div>
    </Layout>
  );
}
