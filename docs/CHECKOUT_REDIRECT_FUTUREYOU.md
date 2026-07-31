# Checkout Redirect Integrity /futureyou Record

## Who

Juss Beautiful Hair customers who press the checkout button, the founder responsible for storefront truth, and future repository operators who must preserve the Stripe boundary.

## What

Current `main` accepted the `url` field returned by `/api/checkout` and assigned it directly to `window.location`. This replacement validates the URL immediately before browser navigation.

The validator allows only:

- HTTPS;
- the exact origin `https://checkout.stripe.com`;
- no embedded username or password;
- no custom port.

Malformed, blank, insecure, credentialed, ported, arbitrary, and lookalike URLs fail closed and remain on the storefront with a visible error.

## Where

- `client/src/lib/checkoutRedirect.mjs`
- `client/src/lib/checkoutRedirect.d.ts`
- `client/src/lib/checkoutRedirect.d.mts`
- `client/src/pages/Checkout.tsx`
- `tests/checkout-redirect-contract.test.mjs`
- `.github/workflows/checkout-redirect-exact-head.yml`

## When

Validation runs only after `/api/checkout` returns an HTTP-success response containing a URL and immediately before `window.location.assign`.

## Why

The Worker currently creates hosted Stripe Checkout Sessions, but a compromised response path, proxy, dependency, or future regression must not gain arbitrary browser-navigation authority. Server-side session creation and client-side destination validation are separate defenses.

## How

1. Parse the returned value with the platform `URL` parser.
2. Require the exact hosted Stripe Checkout origin.
3. Reject insecure protocols, credentials, and custom ports.
4. Return the canonical URL only after all checks pass.
5. Exercise accepted and rejected values through the same module imported by the storefront.
6. Run TypeScript, the focused Node contract, and the production build at one immutable PR head.

## Known

- Current `main` redirects directly to the unvalidated response URL.
- The current Cloudflare Worker creates Stripe Checkout Sessions server-side.
- Stripe secrets and canonical cart pricing remain server-side.
- This change does not alter products, prices, discounts, shipping, Stripe configuration, session creation, or customer data.

## Inferred

Exact-origin validation materially reduces arbitrary redirect and Stripe-lookalike risk even when upstream behavior is compromised.

## Assumed

The intended hosted Checkout Session destination remains `https://checkout.stripe.com`. A future approved Stripe custom domain would require a separate founder-reviewed contract update and proof.

## Unknown

Until an executed exact-head workflow and browser checkout witness exist, the repository does not prove that the final branch compiles, builds, or reaches a live Stripe session successfully.

## Blocked

Merge is blocked when the final head has zero-step, missing-log, stale, skipped, or failing verification. Those receipts are not code passes.

## Verification

Required on the immutable final head:

- `npm ci`
- `npm run check`
- `node --test tests/checkout-redirect-contract.test.mjs`
- `npm run build`
- browser evidence that an actual server-created Stripe Checkout Session is accepted
- browser evidence that a mocked lookalike URL is blocked without navigation
- zero unresolved critical review threads

## Rollback

Revert the eventual focused merge commit. No database, order, customer, Stripe object, environment variable, DNS record, or external communication requires cleanup.

## Next owner

Review the exact-head evidence, confirm the live session host, preserve the exact-origin default, and merge only when executable proof exists. Do not broaden the allowlist for convenience.
