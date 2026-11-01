import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import Cart from "@/pages/Cart";
import ShopifyCartHandoff from "@/pages/ShopifyCartHandoff";
import Checkout from "@/pages/Checkout";
import HairMatch from "@/pages/HairMatch";
import SuccessPage from "@/pages/success";
import About from "@/pages/About";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Shipping from "@/pages/Shipping";
import Returns from "@/pages/Returns";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import HairCare from "@/pages/HairCare";
import LengthGuide from "@/pages/LengthGuide";
import OrderHelp from "@/pages/OrderHelp";
import PrivacyChoices from "@/pages/PrivacyChoices";

const CANONICAL_ORIGIN = "https://jussbeautifulhair.com";
const NON_INDEXABLE_ROUTES = new Set(["/cart", "/checkout", "/success"]);

// Shopify menu URLs remain valid on the Cloudflare headless storefront.
const SHOPIFY_COMPAT_PATHS: Record<string, string> = {
  "/collections/all": "/shop",
  "/pages/contact": "/contact",
  "/pages/about": "/about",
  "/pages/faq": "/faq",
  "/pages/hair-care": "/hair-care",
  "/pages/length-guide": "/length-guide",
  "/pages/order-help": "/order-help",
  "/pages/shipping": "/shipping",
  "/policies/privacy-policy": "/privacy",
  "/policies/refund-policy": "/returns",
  "/policies/terms-of-service": "/terms",
};

function isNonIndexableRoute(pathname: string): boolean {
  return NON_INDEXABLE_ROUTES.has(pathname) || pathname.startsWith("/cart/c/");
}

function RouteDiscoveryMetadata() {
  const [location] = useLocation();

  useEffect(() => {
    const canonicalUrl = new URL(location || "/", CANONICAL_ORIGIN);
    canonicalUrl.pathname = SHOPIFY_COMPAT_PATHS[canonicalUrl.pathname] || canonicalUrl.pathname;
    canonicalUrl.search = "";
    canonicalUrl.hash = "";
    const canonicalHref = canonicalUrl.toString();

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.dataset.jbhDynamic = "true";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;

    let ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      ogUrl.dataset.jbhDynamic = "true";
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalHref;

    const existingRobots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"][data-jbh-dynamic="true"]');
    if (isNonIndexableRoute(canonicalUrl.pathname)) {
      const robots = existingRobots || document.createElement("meta");
      robots.name = "robots";
      robots.content = "noindex, nofollow";
      robots.dataset.jbhDynamic = "true";
      if (!existingRobots) document.head.appendChild(robots);
    } else {
      existingRobots?.remove();
    }
  }, [location]);

  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop/bundles"><Shop initialCategory="Bundles" /></Route>
      <Route path="/shop/wigs"><Shop initialCategory="Wigs" /></Route>
      <Route path="/shop/closures-frontals"><Shop initialCategory="Closures & Frontals" /></Route>
      <Route path="/shop/beauty-essentials"><Shop initialCategory="Beauty Essentials" /></Route>
      <Route path="/shop" component={Shop} />
      <Route path="/collections/all" component={Shop} />
      <Route path="/pages/contact" component={Contact} />
      <Route path="/pages/about" component={About} />
      <Route path="/pages/faq" component={FAQ} />
      <Route path="/pages/hair-care" component={HairCare} />
      <Route path="/pages/length-guide" component={LengthGuide} />
      <Route path="/pages/order-help" component={OrderHelp} />
      <Route path="/pages/shipping" component={Shipping} />
      <Route path="/policies/privacy-policy" component={Privacy} />
      <Route path="/policies/refund-policy" component={Returns} />
      <Route path="/policies/terms-of-service" component={Terms} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart/c/:cartId" component={ShopifyCartHandoff} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/hair-match" component={HairMatch} />
      <Route path="/success" component={SuccessPage} />
      <Route path="/about" component={About} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/shipping" component={Shipping} />
      <Route path="/returns" component={Returns} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/hair-care" component={HairCare} />
      <Route path="/length-guide" component={LengthGuide} />
      <Route path="/order-help" component={OrderHelp} />
      <Route path="/pages/data-sharing-opt-out" component={PrivacyChoices} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Toaster />
          <RouteDiscoveryMetadata />
          <AppRouter />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
