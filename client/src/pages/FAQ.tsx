import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  { q: "How long does shipping take?", a: "Shipping costs and available delivery estimates depend on the item and destination. Review the methods and charges at Shopify checkout. If tracking is supplied, follow the carrier link for current updates." },
  { q: "Is your hair real human hair?", a: "Review the current product description for materials, texture, and care details. If anything is unclear, please contact us before ordering." },
  { q: "Can I dye or bleach the hair?", a: "Color and heat tolerance vary by product. Check its specifications first and ask a qualified stylist to test a small section before any chemical service." },
  { q: "What's your return policy?", a: "Review the published Shopify refund policy linked from our Returns page for current windows, eligibility and exclusions. Contact support for return instructions and an approved mailing address before sending anything." },
  { q: "Do you offer custom wigs or install services?", a: "Please contact us to ask whether custom work or installation services are currently available. We do not confirm appointments through this FAQ." },
  { q: "Do you offer wholesale pricing?", a: "Stylists and salons can submit a wholesale inquiry through our Contact page. Pricing, approval, and availability are confirmed individually." },
  { q: "How do I pick the right length?", a: "Measure from the installation point to your preferred endpoint. Wavy and curly textures may look shorter than straight hair at the same measured length. Our Hair Length Guide has more tips." },
  { q: "Can I track my order?", a: "Check your order confirmation and any shipping emails. You can also use Shopify customer-account order history where available, or contact support privately for help." },
];

export default function FAQ() {
  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            Got Questions?
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">FAQ</h1>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} data-testid={`faq-${i}`}>
              <AccordionTrigger className="text-left font-display text-base text-foreground">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Layout>
  );
}
