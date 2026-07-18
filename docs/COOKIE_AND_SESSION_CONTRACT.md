# Cookie and Session Contract

The public Juss Beautiful Hair storefront sets **zero first-party cookies**.

## Checkout authority

`worker/index.ts` and `api/checkout.ts` remain stateless. They accept an explicit `checkoutAttemptId`, validate the request Origin, rebuild the cart from the canonical catalog, and use the attempt ID as Stripe idempotency. Neither boundary may read, set, copy, or depend on browser cookies.

## Provider-managed cookies

Cloudflare may set security or bot-management cookies at the edge. Stripe may set checkout and fraud-prevention cookies on Stripe-controlled domains after handoff. Those cookies are owned by their providers and are not application state.

The storefront must not:

- inspect or log provider cookie values;
- mirror them into first-party cookies;
- use them as customer, cart, price, payment, inventory, shipping, or order authority;
- add analytics, advertising, fingerprinting, replay, or cross-site tracking cookies.

## Consent

Because the repository enables no nonessential first-party cookie, it does not add a consent cookie or banner. Any future analytics or personalization proposal requires separate privacy review, consent behavior, retention limits, founder approval, and a manifest change before implementation.
