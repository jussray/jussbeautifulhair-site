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
import Checkout from "@/pages/Checkout";
import HairMatch from "@/pages/HairMatch";
import CompleteInstallDeals from "@/pages/CompleteInstallDeals";
import SuccessPage from "@/pages/success";
import About from "@/pages/About";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Shipping from "@/pages/Shipping";
import Returns from "@/pages/Returns";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

const CANONICAL_ORIGIN = "https://jussbeautifulhair.com";
const NON_INDEXABLE_ROUTES = new Set(["/cart", "/checkout", "/success"]);

function RouteDiscoveryMetadata() {
  const [location] = useLocation();

  useEffect(() => {
    const canonicalUrl = new URL(location || "/", CANONICAL_ORIGIN);
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
    if (NON_INDEXABLE_ROUTES.has(canonicalUrl.pathname)) {
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
      <Route path="/shop" component={Shop} />
      <Route path="/collections/complete-install-bundle-deals" component={CompleteInstallDeals} />
      <Route path="/product/:id" component={Product} />
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