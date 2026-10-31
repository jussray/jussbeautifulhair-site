import { Link } from "wouter";
import { Layout } from "@/components/Layout";

const SHOPIFY_PRIVACY_PORTAL = "https://privacy.shopify.com/en";

export default function PrivacyChoices() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Privacy &amp; Your Rights</p>
          <h1 className="font-display text-4xl sm:text-5xl">Your Privacy Choices</h1>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-7 px-6 py-14 text-foreground/85 leading-relaxed">
        <p>Depending on where you live, you may have rights concerning how your personal information is used and shared.</p>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Shopify privacy requests</h2>
          <p>Shopify provides a <a className="text-primary underline" href={SHOPIFY_PRIVACY_PORTAL} target="_blank" rel="noopener noreferrer">privacy request portal</a> for information it processes. Follow the instructions there for available requests and choices.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Juss Beautiful Hair requests</h2>
          <p>To ask about personal information relating to our storefront or an order, use our <Link href="/contact" className="text-primary underline">Contact page</Link>. Please do not include passwords or card numbers in your message.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Review the policy</h2>
          <p>Read the <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> for additional details. This information page does not itself submit or complete an opt-out request; use the applicable portal or contact route.</p>
        </section>
      </article>
    </Layout>
  );
}
