export declare function assertApprovedCheckoutRedirect(rawUrl: unknown): string;

export declare const CHECKOUT_REDIRECT_CONTRACT: Readonly<{
  origin: "https://checkout.stripe.com";
  protocol: "https:";
  credentialsAllowed: false;
  customPortAllowed: false;
}>;
