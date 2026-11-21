# JBH production browser-proof recovery

**Scope:** Existing `jussray/jussbeautifulhair-site` production workflow. Do not create a replacement storefront, bypass Cloudflare security, activate payments, or weaken exact-head gates.

## Observed blocker (2026-11-21)

`Shopify Checkout Bridge Exact-Head Gate` failed at `Prove exact live SHA and branded front door` because the production job lacked a valid `CLOUDFLARE_ACCOUNT_ID` and/or `CLOUDFLARE_BROWSER_RUN_TOKEN` input. The step's generic error does not identify which one is absent. The downstream Founder Funnel gate cannot pass until the trusted production browser proof succeeds.

The Cloudflare production storefront's public `/version` returned SHA `223edf0682da4e0d89d658cda6191b95afd3cc33` and `/api/commerce/catalog` returned `{"mode":"jusspay_unavailable","products":[]}` when observed. These are observations, not payment activation authority.

## Owner-managed credential restoration

1. In Cloudflare, create or confirm a dedicated **account-scoped** API token with **Browser Rendering — Edit** permission for Browser Run CDP (do not substitute a global API key). Treat the token as a secret and do not paste it into chat, commits, PRs, or logs.
2. In GitHub, open repository **Settings → Environments → Production → Environment secrets**. Set or repair `CLOUDFLARE_BROWSER_RUN_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the 32-character account ID). The production-proof job references the **Production** environment. Inspect both repository and environment secrets if a correct repository secret appears ignored.
3. Run the existing **Shopify Checkout Bridge Exact-Head Gate** via `workflow_dispatch` on `main`, with `browser_token_preflight=true`, as repository owner. This checks the Browser Run CDP handshake and live `/version` identity; **no deployment or payment**.
4. If the credential preflight is green, rerun the failed production browser-proof job for the current trusted `main` SHA. Confirm `frontdoor-live/manifest.json` and the exact live identity; never reuse a receipt from an older SHA.
5. Only after the checkout production proof is green, rerun the Founder Funnel production readback. This may separately require `CLOUDFLARE_API_TOKEN` with appropriate permissions for its Analytics Engine readback.
6. The JussPay catalog currently fails closed. Do not mark checkout operational until approved SKUs are actually returned by a **live** catalog and a no-payment checkout-path verification passes. Keep `JBH_JUSSPAY_LIVE_ENABLED`, `JBH_JUSSPAY_SANDBOX_ENABLED`, and `JBH_STRIPE_LIVE` disabled until their independent authorization gates are satisfied.

## Rollback and evidence

The early credential preflight and metadata corrections are source-only changes. Revert the corresponding commits if they cause regressions. Never change domain routing, payment controls, or the Production environment policy merely to make a CI status green.

Sources:
- Cloudflare Browser Run CDP guide: https://developers.cloudflare.com/browser-run/cdp/
- GitHub environment secrets: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
