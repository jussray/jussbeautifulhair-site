export const JBH_VISION = Object.freeze({
  id: "trusted-hair-commerce",
  stage: "live-storefront",
  northStar: "Turn customer attention into repeat trust through accurate product truth, secure checkout, clear policies, and recoverable commerce operations.",
  source: "docs/VISION.md",
});

export const JBH_GUARDRAILS = Object.freeze([
  Object.freeze({ id: "JBH-TRUTH-001", status: "active", summary: "Product, price, stock, shipping, returns, affiliation, and result claims require approved business truth." }),
  Object.freeze({ id: "JBH-CHECKOUT-001", status: "active", summary: "Checkout redirects only to approved HTTPS Stripe hosts." }),
  Object.freeze({ id: "JBH-SECRET-001", status: "active", summary: "Secrets, supplier credentials, customer records, and admin controls stay out of the public bundle." }),
  Object.freeze({ id: "JBH-ADMIN-001", status: "active", summary: "Administrative interfaces remain separate from the public storefront." }),
  Object.freeze({ id: "JBH-POLICY-001", status: "active", summary: "Shipping, returns, privacy, terms, and contact paths remain reachable." }),
  Object.freeze({ id: "JBH-MOBILE-001", status: "active", summary: "Core storefront navigation remains usable on phone-sized screens." }),
  Object.freeze({ id: "JBH-STATE-001", status: "active", summary: "Cart, checkout, payment, order, notification, fulfillment, and shipment remain distinct states." }),
]);

const APPROVED_STRIPE_HOSTS = new Set(["checkout.stripe.com", "buy.stripe.com"]);

export function assertApprovedCheckoutUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("Checkout did not return a valid redirect URL.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Checkout returned a malformed redirect URL.");
  }

  const hostname = url.hostname.toLowerCase();
  const approvedHost = APPROVED_STRIPE_HOSTS.has(hostname) || hostname.endsWith(".stripe.com");
  if (url.protocol !== "https:" || !approvedHost || url.username || url.password) {
    throw new Error("Checkout redirect was blocked because it was not an approved Stripe URL.");
  }

  return url.toString();
}

export function installJbhGuardrailRuntime() {
  const snapshot = Object.freeze({
    version: "1.0.0",
    vision: JBH_VISION,
    guardrails: JBH_GUARDRAILS,
    checkoutHosts: [...APPROVED_STRIPE_HOSTS],
    publicAdminSurface: false,
    secretsInClient: false,
  });

  document.documentElement.dataset.guardrails = "active";
  document.documentElement.dataset.productStage = JBH_VISION.stage;
  Object.defineProperty(window, "__JBH_GUARDRAILS__", {
    value: snapshot,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return snapshot;
}

declare global {
  interface Window {
    __JBH_GUARDRAILS__?: ReturnType<typeof installJbhGuardrailRuntime>;
  }
}
