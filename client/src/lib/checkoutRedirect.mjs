const APPROVED_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

/**
 * Fail closed before handing browser navigation to a checkout URL returned by
 * the server. The current Worker creates Stripe Checkout Sessions, whose
 * hosted payment URL belongs to checkout.stripe.com.
 *
 * @param {unknown} rawUrl
 * @returns {string}
 */
export function assertApprovedCheckoutRedirect(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("Checkout did not return a valid payment URL.");
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Checkout returned a malformed payment URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.origin !== APPROVED_CHECKOUT_ORIGIN ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Checkout redirect was blocked because the payment host was not approved.");
  }

  return url.toString();
}

export const CHECKOUT_REDIRECT_CONTRACT = Object.freeze({
  origin: APPROVED_CHECKOUT_ORIGIN,
  protocol: "https:",
  credentialsAllowed: false,
  customPortAllowed: false,
});
