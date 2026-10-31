import { Link } from "wouter";
import { Layout } from "@/components/Layout";
export default function Shipping() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Policies</p>
          <h1 className="font-display text-4xl sm:text-5xl">Shipping Information</h1>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-6 px-6 py-14 text-foreground/85 leading-relaxed">
        <h2 className="font-display text-xl text-foreground">Shipping options and cost</h2>
        <p>Available shipping methods, delivery estimates, taxes, and shipping charges are calculated or confirmed at Shopify checkout for your destination and order. Shipping offers may vary by item and address. Review the total before paying.</p>
        <h2 className="font-display text-xl text-foreground">Processing and tracking</h2>
        <p>Processing and transit times can vary by product, availability, destination, and carrier. When a tracking link is provided, use that link to check the shipment's current status.</p>
        <h2 className="font-display text-xl text-foreground">Help with an order</h2>
        <p>If you need an update or notice a shipping issue, use <Link href="/order-help" className="text-primary underline">Order Help</Link> or <Link href="/contact" className="text-primary underline">Contact</Link>. Do not include private order details in public comments.</p>
      </article>
    </Layout>
  );
}
