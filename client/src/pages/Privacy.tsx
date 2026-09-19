import { Layout } from "@/components/Layout";

export default function Privacy() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            Policies
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-primary-foreground/70">
            Last updated: September 17, 2026
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="prose prose-neutral max-w-none">
          <p>
            Juss Beautiful Hair ("we", "us", "our") operates jussbeautifulhair.com (the "Site").
            This page tells you what information we collect, how we use it, and the choices you have.
          </p>

          <h2 className="font-display text-2xl mt-8 mb-3">Information we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Order information</strong> — your name, email, shipping address, items purchased, and order total after an order is created through Shopify.</li>
            <li><strong>Payment information</strong> — collected and processed on Shopify-hosted checkout and the payment providers enabled there. Juss Beautiful Hair does not receive or store your full card number, CVC, or bank credentials in the public storefront.</li>
            <li><strong>Contact / newsletter</strong> — if you sign up or message us, we keep your email and the content of your message.</li>
            <li><strong>Site usage</strong> — basic technical and storefront event data, such as browser type and pages or shopping steps viewed, used to operate and improve the Site.</li>
          </ul>

          <h2 className="font-display text-2xl mt-8 mb-3">How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fulfill and ship your order.</li>
            <li>Send order confirmations, shipping updates, and customer service replies.</li>
            <li>Send marketing emails — only if you opted in. You can unsubscribe any time.</li>
            <li>Prevent fraud, protect the Site, and comply with the law.</li>
            <li>Understand whether the shopping experience is working as intended.</li>
          </ul>

          <h2 className="font-display text-2xl mt-8 mb-3">Who we share it with</h2>
          <p>We share the minimum information needed with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Shopify</strong> — to provide hosted checkout, payment processing, and order creation. See <a href="https://www.shopify.com/legal/privacy" className="underline">Shopify's privacy policy</a>.</li>
            <li><strong>Our shipping partners and suppliers</strong> — to ship your order to you.</li>
            <li><strong>Cloudflare</strong> — to deliver and protect the public storefront and provide basic technical traffic signals.</li>
            <li><strong>Neon</strong> — to store private order and customer records used for fulfillment and owner operations.</li>
          </ul>
          <p>We do <strong>not</strong> sell or rent your personal information to anyone.</p>

          <h2 className="font-display text-2xl mt-8 mb-3">Cookies and browser storage</h2>
          <p>
            We use browser storage and a small number of cookies needed to keep the Site and shopping experience working.
            Shopify may set its own cookies when you continue to hosted checkout. We do not use third-party advertising cookies on the public storefront.
          </p>

          <h2 className="font-display text-2xl mt-8 mb-3">Your choices</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Unsubscribe from marketing emails using the link in any email.</li>
            <li>Request a copy of the personal data we hold about you, or ask us to delete it, by emailing us (see Contact).</li>
            <li>California, Virginia, Colorado, Connecticut, and Utah residents have additional rights under state privacy laws — email us to exercise them.</li>
          </ul>

          <h2 className="font-display text-2xl mt-8 mb-3">Children</h2>
          <p>The Site is not directed to children under 13. We do not knowingly collect data from children.</p>

          <h2 className="font-display text-2xl mt-8 mb-3">Security</h2>
          <p>
            The public storefront is delivered over HTTPS through Cloudflare. Checkout and payment are completed on Shopify-hosted checkout, and the public storefront does not store full payment credentials. Private order records used for fulfillment are stored in Neon and transmitted over encrypted connections.
          </p>

          <h2 className="font-display text-2xl mt-8 mb-3">Changes</h2>
          <p>
            If we change this policy, we'll update the date at the top of this page.
            Material changes will be announced on the home page.
          </p>

          <h2 className="font-display text-2xl mt-8 mb-3">Contact</h2>
          <p>
            Questions? Email <a href="mailto:hello@jussbeautifulhair.com" className="underline">hello@jussbeautifulhair.com</a> or
            visit our <a href="/#/contact" className="underline">Contact page</a>.
          </p>
        </div>
      </section>
    </Layout>
  );
}
