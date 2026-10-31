import { Link } from "wouter";
import { Layout } from "@/components/Layout";

const SHOPIFY_ORDERS_URL = "https://shopify.com/84576043251/account/orders";

export default function OrderHelp() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Customer Support</p>
          <h1 className="font-display text-4xl sm:text-5xl">Order Help</h1>
          <p className="mt-4 text-primary-foreground/80">Find order updates and the right support route.</p>
        </div>
      </section>
      <article className="mx-auto max-w-2xl space-y-7 px-6 py-14 text-foreground/85 leading-relaxed">
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Find your confirmation</h2>
          <p>Check the inbox used at checkout for your order confirmation and any shipping notification. If a carrier tracking link was provided, use the carrier's link for the latest shipment status.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Shopify order history</h2>
          <p>If you checked out with a Shopify customer account, you can open your <a className="text-primary underline" href={SHOPIFY_ORDERS_URL} target="_blank" rel="noopener noreferrer">Shopify order history</a>. Sign in through Shopify; this storefront does not display private order records.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Need help?</h2>
          <p>Use our <Link href="/contact" className="text-primary underline">Contact</Link> page for an order question. Do not post your address, payment details, or order information in public comments or social posts.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl text-foreground">Shipping and returns</h2>
          <p>Before requesting a return, review the current <Link href="/returns" className="text-primary underline">Return &amp; Refund Policy</Link>. See also our <Link href="/shipping" className="text-primary underline">Shipping Policy</Link>. Where checkout and storefront policies differ, contact support for clarification before sending a return.</p>
        </section>
      </article>
    </Layout>
  );
}
