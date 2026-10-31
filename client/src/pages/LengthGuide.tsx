import { Link } from "wouter";
import { Layout } from "@/components/Layout";

export default function LengthGuide() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Choose Your Look</p>
          <h1 className="font-display text-4xl sm:text-5xl">Hair Length Guide</h1>
          <p className="mt-4 text-primary-foreground/80">Find the length that works for your style and installation.</p>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-7 px-6 py-14 text-foreground/85 leading-relaxed">
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Measure from the installation point</h2>
          <p>Use a flexible measuring tape from the point where the hair will be attached or installed to the place you want the ends to reach. Compare that distance with the listed product length.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Texture changes the appearance</h2>
          <p>Wavy and curly textures can appear shorter than straight hair of the same measured length. Check each product listing for how its length is measured; an example photo is not a guaranteed fit.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Consider placement and styling</h2>
          <p>Wig construction, parting, volume, layering, and where the hair sits can all affect the finished look. If you plan to trim or style the hair, allow for that when choosing a length.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Still deciding?</h2>
          <p>Review the product details, then explore <Link href="/hair-match" className="text-primary underline">Hair Match</Link> for personal guidance or <Link href="/contact" className="text-primary underline">ask us a question</Link> before ordering.</p>
        </section>
      </article>
    </Layout>
  );
}
