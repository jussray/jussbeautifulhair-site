# Juss Beautiful Hair Guardrails

These guardrails are implemented in `client/src/config/visionGuardrails.ts` and verified with Playwright.

| ID | Requirement | Enforcement |
|---|---|---|
| `JBH-TRUTH-001` | Product, price, stock, shipping, returns, affiliation, and result claims require approved business truth. | Runtime snapshot and policy-route verification; no generated claim may silently become catalog truth. |
| `JBH-CHECKOUT-001` | Checkout redirects only to approved HTTPS Stripe hosts. | `assertApprovedCheckoutUrl()` rejects non-HTTPS, malformed, and non-Stripe URLs before browser navigation. |
| `JBH-SECRET-001` | Stripe secrets, webhook secrets, supplier credentials, customer records, and admin controls stay out of the public bundle. | Public runtime snapshot is allowlisted; Playwright scans rendered content and navigation. |
| `JBH-ADMIN-001` | Administrative interfaces remain separate from the public storefront. | Public router has no admin route; Playwright verifies no admin navigation or controls are exposed. |
| `JBH-POLICY-001` | Shipping, returns, privacy, terms, and contact paths remain reachable. | Playwright visits public policy routes. |
| `JBH-MOBILE-001` | Core storefront navigation remains usable at mobile width. | Playwright runs guardrail checks on desktop and phone-sized Chromium projects. |
| `JBH-STATE-001` | Cart, checkout session, payment, order, notification, fulfillment, and shipment remain distinct states. | Runtime vision snapshot and server checkout boundary; UI copy must not claim fulfillment before payment/order evidence. |

## Checkout URL allowlist

Approved redirect URLs must:

- parse as absolute URLs;
- use `https:`;
- use `checkout.stripe.com`, `buy.stripe.com`, or another true `*.stripe.com` hostname;
- never include embedded credentials.

The host check uses URL parsing and exact domain boundaries. A hostname such as `stripe.com.evil.example` is rejected, because apparently string matching alone still needs adult supervision.

## Verification

```bash
npm install
npx playwright install chromium
npm run test:guardrails
```

Playwright verifies runtime guardrail metadata, checkout redirect validation, public policy routes, mobile rendering, absence of public admin controls, and absence of obvious secret material.