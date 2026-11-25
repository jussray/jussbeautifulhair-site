# JBH Cloudflare Browser Run proof recovery

## Current failure

On `main` commit `dd60ce7e2ac92975f842958ed742c5d6e47285b9` (2026-11-23), the Worker build gate passed, but the trusted production browser job fell back to GitHub-runner Chromium because Browser Run credentials were absent. The runner received **HTTP 403** at `https://jussbeautifulhair.com/version`; downstream Founder Funnel proof failed too.

This recovery patch **removes the runner-local fallback from trusted production proof** and fails early if either credential input is missing. It does not invent credentials, lower site protection, turn on money movement, or treat an absent proof as green.

## Founder-controlled setup (no secrets in repository code)

1. Confirm a dedicated Cloudflare API token with account-scoped **Browser Rendering — Edit** permission for Browser Run CDP. Do not use a global API key.
2. In GitHub repository Settings > Environments > Production > Environment secrets, set `CLOUDFLARE_BROWSER_RUN_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. If they are already configured as repository-level Actions secrets, check for conflicting environment-level values. Never print, commit, or send the token.
3. Dispatch `Shopify Checkout Bridge Exact-Head Gate` from `main` with `browser_token_preflight=true` as the authorized owner. This checks the browser connection and `/version` only—no deployment or charge.
4. After the preflight passes, rerun the current trusted `main` production-proof workflow, and require its browser artifact to match the exact deployed SHA. Then rerun Founder Funnel exact-head proof.
5. Confirm `/api/commerce/catalog` serves a **live, approved** JussPay catalog and verify the no-charge customer checkout journey before considering any production money switch. Do not confuse `jusspay_unavailable` or zero products with a ready checkout.

## Safeguards

Keep the production payment flags default-off; no fallback to Shopify or local browser proof should silently authorize payments. If this patch causes regression, revert its changes without touching existing routes or DNS. Evidence is scoped to the current SHA and must be reacquired after each deployment.
