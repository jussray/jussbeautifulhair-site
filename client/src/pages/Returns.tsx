import { Link } from "wouter";
import { Layout } from "@/components/Layout";
const SHOPIFY_REFUND_POLICY_URL = "https://checkout.shopify.com/84576043251/policies/47609413875.html?locale=en";
export default function Returns() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Policies</p>
          <h1 className="font-display text-4xl sm:text-5xl">Return &amp; Refund Policy</h1>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-6 px-6 py-14 text-foreground/85 leading-relaxed">
        <p>Our <a className="text-primary underline" href={SHOPIFY_REFUND_POLICY_URL} target="_blank" rel="noopener noreferrer">published Shopify refund policy</a> describes the current return request window, eligibility, exclusions, and refund process.</p>
        <h2 className="font-display text-xl text-foreground">Before mailing an item</h2>
        <p>Please <Link href="/contact" className="text-primary underline">contact us</Link> to request a return and receive the correct instructions and approved mailing address. Do not send an item to an unconfirmed address.</p>
        <h2 className="font-display text-xl text-foreground">Wrong, missing, or damaged items</h2>
        <p>If your order is incorrect or arrives damaged, please contact us promptly with the relevant details so our team can review your request.</p>
        <p>For questions about an existing order, visit <Link href="/order-help" className="text-primary underline">Order Help</Link>. The Shopify policy governs the terms for Shopify purchases; no different return window is promised on this page.</p>
      </article>
    </Layout>
  );
}
