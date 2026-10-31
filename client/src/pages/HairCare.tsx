import { Link } from "wouter";
import { Layout } from "@/components/Layout";

export default function HairCare() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Care &amp; Maintenance</p>
          <h1 className="font-display text-4xl sm:text-5xl">Hair Care Guide</h1>
          <p className="mt-4 text-primary-foreground/80">Practical care tips for your bundles, wigs, and extensions.</p>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-7 px-6 py-14 text-foreground/85 leading-relaxed">
        <p>Always follow any care instructions provided with your particular product. The suggestions below are general guidance; needs vary by texture, construction, and processing.</p>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Detangle gently</h2>
          <p>Start at the ends and work toward the roots in small sections. Support the hair near the weft or lace, and use a wide-tooth comb or suitable brush. Avoid pulling on knots or lace.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Wash and condition</h2>
          <p>Use a gentle product suited to your hair type and rinse thoroughly. Handle wet hair carefully. For wigs, keep adhesives and lace-care products away from areas the manufacturer says to avoid.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Dry before storing</h2>
          <p>Let hair dry fully before putting it away. Store in a clean, dry place to limit tangling. Avoid leaving damp hair bundled up.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Use heat and color carefully</h2>
          <p>Check whether your exact product supports heat or chemical processing. Use appropriate heat protection and lower temperatures when possible. Color and bleach results vary; ask a qualified stylist and test a small section first.</p>
        </section>
        <p>For help choosing a texture or a care routine, visit our <Link className="text-primary underline" href="/hair-match">Hair Match</Link> page or <Link className="text-primary underline" href="/contact">contact us</Link>. No specific product lifespan or result is guaranteed by this general guide.</p>
      </article>
    </Layout>
  );
}
