import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Truck, Heart, MessageCircle, ArrowRight, Check, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { BrandMoatSection } from "@/components/BrandMoatSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BRAND } from "@/lib/catalog";
import { useShopifyCatalog } from "@/lib/shopifyCatalog";
import { TurnstileChallenge } from "@/components/TurnstileChallenge";
import { getNewsletterEndpoint } from "@/lib/privateIngress";

const VALUES = [
  {
    icon: Truck,
    title: "Live Inventory",
    body: "Product availability and pricing are read from Shopify so the storefront does not promise stale stock.",
  },
  {
    icon: Heart,
    title: "Product Facts First",
    body: "Review current product details, options, pricing, and policies before you choose your install.",
  },
  {
    icon: MessageCircle,
    title: "Human Support",
    body: "Questions before or after checkout can be sent to hello@jussbeautifulhair.com.",
  },
];

export default function Home() {
  const {
    data: products = [],
    isLoading,
    isError,
    isRefetchError,
    isFetching,
    refetch,
  } = useShopifyCatalog();
  const catalogUnavailable = isError || isRefetchError;
  const authoritativeProducts = catalogUnavailable ? [] : products;
  const availableProducts = authoritativeProducts.filter((product) => product.availableForSale);
  const featured = availableProducts.slice(0, 4);
  const signature =
    availableProducts.find((product) => /juss blonde/i.test(product.name)) ||
    availableProducts.find((product) => /body wave human hair bundles/i.test(product.name)) ||
    featured[0];
  const categoryPreview = availableProducts.slice(4, 8);
  const { toast } = useToast();
  const newsletterEndpoint = useMemo(getNewsletterEndpoint, []);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const newsletterConfigured = Boolean(newsletterEndpoint && turnstileSiteKey);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subscribing || !email.trim()) return;

    if (!newsletterConfigured || !newsletterEndpoint) {
      toast({
        title: "Email signup is temporarily unavailable",
        description: "Please check back soon.",
        variant: "destructive",
      });
      return;
    }

    if (!newsletterConsent) {
      toast({
        title: "Consent required",
        description: "Please confirm that you want to receive JBH marketing updates.",
        variant: "destructive",
      });
      return;
    }

    if (!turnstileToken) {
      toast({
        title: "Verification required",
        description: "Complete the security check before joining the list.",
        variant: "destructive",
      });
      return;
    }

    setSubscribing(true);
    try {
      const response = await fetch(newsletterEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent: newsletterConsent,
          turnstileToken,
          companyWebsite,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        subscribed?: boolean;
        receipt?: string;
        error?: string;
      };

      if (!response.ok || !result.subscribed) {
        throw new Error(result.error || "Newsletter signup failed");
      }

      setSubscribed(true);
      setEmail("");
      setNewsletterConsent(false);
      setTurnstileToken("");
      toast({
        title: "You're on the list 💜",
        description: "Your signup was saved securely.",
      });
    } catch {
      setTurnstileToken("");
      window.turnstile?.reset();
      toast({
        title: "We couldn't save your signup",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Layout>
      <section className="relative bg-primary">
        <img
          src="/jbh_homepage_hero.jpg"
          alt="Premium hair. Lawless energy."
          className="w-full h-auto block"
        />
        <div className="hidden md:block absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-primary/70 to-transparent pointer-events-none" />
        <div className="hidden md:flex absolute left-8 bottom-8 lg:left-16 lg:bottom-12 gap-3 z-10">
          <Link href="/shop">
            <Button
              size="lg"
              data-testid="button-shop-hero"
              className="bg-white text-primary hover:bg-white/90 font-semibold px-8 shadow-xl"
            >
              Shop Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/hair-match">
            <Button
              size="lg"
              data-testid="button-hair-match-hero"
              className="border border-white/80 bg-primary/75 text-white hover:bg-primary/90 font-semibold px-8 shadow-xl"
            >
              Hair Match · $25
            </Button>
          </Link>
        </div>
        <div className="md:hidden px-6 py-6 bg-primary space-y-3">
          <Link href="/shop">
            <Button
              size="lg"
              data-testid="button-shop-hero-mobile"
              className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
            >
              Shop Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/hair-match">
            <Button
              size="lg"
              data-testid="button-hair-match-hero-mobile"
              className="w-full border border-white/80 bg-primary/75 text-white hover:bg-primary/90 font-semibold"
            >
              Hair Match · $25
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-12 grid gap-8 sm:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="flex flex-col items-start">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary/40 text-primary mb-4">
                <value.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg text-foreground">{value.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      <BrandMoatSection />

      <section className="mx-auto max-w-7xl px-6 pt-12" data-testid="hair-match-home-offer">
        <div className="rounded-2xl border border-gold/30 bg-secondary/20 p-6 sm:p-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.25em] text-gold mb-2">Need help choosing?</p>
            <h2 className="font-display text-2xl sm:text-3xl text-foreground">Start with a $25 Hair Match</h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Get a personal recommendation for texture, length, lace, bundles, or wigs. The full $25 becomes
              purchase credit toward an eligible future JBH order.
            </p>
          </div>
          <Link href="/hair-match" className="shrink-0">
            <Button size="lg" data-testid="button-start-hair-match-home" className="font-semibold">
              Start My Hair Match <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold mb-2">Live from Shopify</p>
            <h2 className="font-display text-3xl sm:text-4xl text-foreground">Featured Hair</h2>
          </div>
          <Link
            href="/shop"
            data-testid="link-viewall"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-gold"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Loading live inventory">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : catalogUnavailable ? (
          <div
            role="alert"
            data-testid="home-catalog-unavailable"
            className="rounded-lg border border-card-border bg-card p-8 text-center"
          >
            <h3 className="font-display text-2xl text-foreground">Live inventory could not be verified</h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
              Shopify inventory is unavailable right now. No stale prices or availability are being shown.
            </p>
            <Button
              type="button"
              className="mt-6"
              data-testid="button-retry-home-catalog"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Checking Shopify…" : "Try Again"}
            </Button>
          </div>
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div
            data-testid="home-catalog-verified-empty"
            className="rounded-lg border border-card-border bg-card p-8 text-center text-muted-foreground"
          >
            No Shopify products are available for sale right now.
          </div>
        )}
      </section>

      {signature && (
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">The Gold Standard</p>
              <h2 className="font-display text-3xl sm:text-4xl leading-tight">{signature.name}</h2>
              <p className="mt-4 text-primary-foreground/80 leading-relaxed line-clamp-4">
                {signature.description}
              </p>
              <Link href={`/product/${signature.id}`}>
                <Button
                  size="lg"
                  data-testid="button-shop-signature"
                  className="mt-6 bg-gold text-primary hover:bg-gold font-semibold"
                >
                  Shop This Look <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="rounded-lg overflow-hidden border border-gold/30 bg-primary-foreground/5">
              {signature.image ? (
                <img
                  src={signature.image}
                  alt={signature.name}
                  className="w-full aspect-[4/3] object-cover"
                />
              ) : (
                <div className="w-full aspect-[4/3] grid place-items-center text-primary-foreground/60">
                  Product image updating
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {categoryPreview.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="font-display text-3xl text-center text-foreground mb-2">More to Explore</h2>
          <p className="text-center text-muted-foreground mb-10">
            {availableProducts.length} live products currently available through Shopify.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {categoryPreview.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="bg-secondary/30">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Join the inner circle</p>
          <h2 className="font-display text-3xl text-foreground">Lawless Energy, In Your Inbox</h2>
          <p className="mt-3 text-muted-foreground">
            Opt in for future restock alerts, early access, product updates, and new drops from {BRAND.name}.
          </p>
          {subscribed ? (
            <p
              data-testid="text-subscribed"
              className="mt-6 inline-flex items-center gap-2 text-primary font-medium"
            >
              <Check className="h-5 w-5 text-gold" /> You're on the list. Welcome 💜
            </p>
          ) : (
            <form
              onSubmit={subscribe}
              className="mt-6 max-w-md mx-auto space-y-4 text-left"
              data-testid="newsletter-form"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@email.com"
                  data-testid="input-newsletter"
                  className="bg-card"
                />
                <Button
                  type="submit"
                  disabled={subscribing || !newsletterConfigured}
                  data-testid="button-subscribe"
                  className="font-semibold sm:min-w-32"
                >
                  {subscribing ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Saving…
                    </span>
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </div>

              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="newsletter-company-website">Company website</label>
                <Input
                  id="newsletter-company-website"
                  name="companyWebsite"
                  value={companyWebsite}
                  onChange={(event) => setCompanyWebsite(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>

              <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={newsletterConsent}
                  onChange={(event) => setNewsletterConsent(event.target.checked)}
                  data-testid="checkbox-newsletter-consent"
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  I agree to receive Juss Beautiful Hair marketing updates by email. I can unsubscribe later. See the{" "}
                  <Link href="/privacy" className="font-medium text-primary underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {turnstileSiteKey ? (
                <TurnstileChallenge
                  siteKey={turnstileSiteKey}
                  action="newsletter"
                  onToken={setTurnstileToken}
                  testId="newsletter-turnstile"
                />
              ) : null}

              {!newsletterConfigured ? (
                <p className="text-xs text-destructive" role="alert" data-testid="newsletter-unavailable">
                  Email signup is temporarily unavailable. No signup will be claimed until the private ingress is configured.
                </p>
              ) : null}
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}
