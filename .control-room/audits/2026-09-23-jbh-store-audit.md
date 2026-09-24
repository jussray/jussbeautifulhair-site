# JBH Store Audit — 2026-09-23

## Authority
- Repository: `jussray/jussbeautifulhair-site`
- Branch: `main`
- Pre-audit HEAD inspected: `a2166f686b19e082ddb5033d1e38eb62c01e4e00`
- Shopify shop: `8qp1z2-az.myshopify.com`
- Public storefront target: `https://jussbeautifulhair.com`

## Goal
Audit the current JBH store with emphasis on Dropship Beauty product imagery, brand consistency, catalog exposure, and the customer money path.

## Inspected
- Shopify product catalog and `dropship-beauty` tagged inventory
- Shopify collections
- Shopify 30-day sessions/conversion analytics
- Shopify 30-day sales analytics
- `client/src/lib/shopifyCatalog.ts`
- `client/src/pages/Home.tsx` search evidence
- `README.md` / Shopify headless bridge evidence
- recent repository commits
- prior catalog-parity PR evidence

## VERIFIED
1. Dropship Beauty products are customer-branded in Shopify as vendor `JBH`; supplier identity is carried by the private tag `dropship-beauty`.
2. The Shopify catalog currently contains 24 active products tagged `dropship-beauty`.
3. Several Shopify product hero assets still use opaque supplier-style filenames, while a smaller set has JBH-named hero assets.
4. `client/src/lib/shopifyCatalog.ts` is a public presentation firewall: Shopify owns live variant IDs, price, and availability; JBH owns customer-facing product names, descriptions, approved options, and images.
5. Unmapped Shopify products are intentionally excluded from the public React storefront by `applyJbhPresentation`.
6. The currently inspected public presentation map contains only a subset of the 24 Dropship Beauty-tagged products. The mapped supplier-backed entries include Body Wave, Deep Wave, Loose Wave, Kinky Straight, and Kinky Curly bundles. Other Dropship Beauty-tagged products such as bundle deals, several closures/frontals, lashes, Spanish Wave, Straight bundles, Blonde, Afro Kinky, and related SKUs are not present in the inspected public presentation map.
7. For mapped bundle products, the customer-facing image authority is the JBH presentation map and its `/products/...` assets, not the Shopify featured image alone. Kinky Curly intentionally has a blank mapped image and falls back to the customer-safe placeholder until an approved JBH asset exists.
8. The headless storefront is designed to fetch the live Shopify catalog through `/api/shopify/catalog` inside the `JBH` vendor boundary and then apply the JBH presentation allowlist.
9. Shopify analytics for the last 30 days show 5 sessions, 0 add-to-carts, 0 reached checkout, 0 completed checkout, and $0 sales.
10. Shopify has multiple older JBH manual-procurement products still ACTIVE with zero inventory. Public visibility/purchasability of those zero-inventory items was not browser-verified in this audit.
11. The authoritative historical repo `jussray/jussbeautifulhair1` explicitly states it is not production authority; `jussray/jussbeautifulhair-site` is the public storefront source.

## INFERRED
1. Replacing Shopify media alone cannot fully repair public storefront imagery for mapped products because the React presentation layer overrides the customer-facing image.
2. The highest-leverage image repair is to normalize approved JBH assets in the presentation layer first, then keep Shopify media aligned as secondary/admin/catalog truth where appropriate.
3. Catalog/image parity should be handled as an allowlist expansion problem, not by exposing all supplier imports automatically.
4. Conversion is currently too traffic-starved to judge merchandising performance from sales data alone.

## UNKNOWN
1. Exact live rendered appearance of every product card/PDP on `jussbeautifulhair.com` during this audit.
2. Whether the newest Shopify image changes are already reflected in the current public deployment.
3. Whether every mapped `/products/...` image asset matches its real product and current JBH visual system at mobile and desktop breakpoints.
4. Whether all active zero-inventory manual products are suppressed by the live storefront.
5. Full real-browser customer path from product card → PDP → variant → cart → Shopify checkout on the current deployment.

## BLOCKED
- No new Playwright/runtime screenshot proof was produced in this audit pass, so rendered storefront behavior remained unverified.
- The Opera Browser Connector was also disconnected during the pass, but Opera is not the JBH browser authority and its connection state is not a release or verification blocker.
- The next valid browser-proof action is Playwright on the exact target head/deployment. Generic web fetches or Opera screenshots do not substitute for that gate.

## Fixes Applied
- No storefront code or Shopify product media was changed in this audit pass.
- This continuity receipt was added so the next agent can resume without re-auditing the source-of-truth.
- Continuity correction on 2026-09-24: Playwright is the primary browser/runtime proof authority; Opera is optional secondary tooling only and must never block progress.

## Required Repair
1. Treat `client/src/lib/shopifyCatalog.ts` and approved JBH `/products/...` assets as the image presentation authority for the custom storefront.
2. Build a product-by-product allowlist for all 24 `dropship-beauty` tagged products that the founder actually wants public.
3. For each approved product, supply a real, correctly matched, customer-safe JBH image asset and explicit allowed variant list.
4. Keep unapproved supplier imports hidden.
5. Sync Shopify hero/gallery media only where needed for admin/catalog parity; do not assume Shopify media alone controls the public storefront.
6. Preserve the existing JBH visual shell and product-card/PDP behavior.
7. Verify desktop/mobile with real browser Playwright: home/collection → product card → PDP → variant → add to cart → cart image → Shopify checkout handoff.

## Risk
- Expanding the allowlist without verified images could expose supplier photography or incorrect/mismatched imagery.
- Updating only Shopify images could create a false-positive repair while the public React storefront continues to render local JBH assets or placeholders.
- Updating only repo assets without Shopify/admin parity could leave internal/catalog surfaces inconsistent.

## Rollback
- Revert this audit-receipt commit to remove the receipt.
- Any future image repair should remain reversible by restoring the prior presentation-map entry and prior asset/media ID for each product.

## Next Gate
Repair the Dropship Beauty image set at the actual public presentation authority, then run production Playwright on `jussbeautifulhair.com` before calling the store image issue fixed.