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
- Direct live browser verification was blocked because the Opera Browser Connector was not connected during this audit and the generic web fetch could not access the storefront.
- Therefore no new Playwright/runtime screenshot proof was produced in this pass.

## Fixes Applied
- No storefront code or Shopify product media was changed in this audit pass.
- This continuity receipt was added so the next agent can resume without re-auditing the source-of-truth.

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
---

## Continuation — Dropship Beauty image repair (agent session 013zvvpW2dxmJ5UxNJyLdK3r)

### SHAs
- Starting: `main` @ `87bfba1556a35bf5e6114ec2bf2cf9cbc9e6a543` (this receipt). Repair branch
  `claude/dropship-beauty-images-qqlu53` held `ff55a13` and `66dfd67` (earlier pass), then merged `main` at `b2d170b`.
- Ending code SHA: `be6a46d` (relabel tool). This receipt update is the commit after it.
- Nothing is merged to `main` or deployed. Merge requires exact founder approval.

### Image rule, as the founder clarified it
"Never present an AI-generated hair product as the real item" means **never misrepresent the
merchandise**. Styled or generated JBH brand imagery is allowed when it shows the correct
product type, texture, and construction. Not allowed: a wrong texture, another texture's photo
reused, the wrong construction, or supplier or off-brand identity on the product.

### Correction to the earlier pass
The first pass took "Dropship Beauty products" from `jbh-private`'s vendor-selection record
(edge control, lace melt spray, hair oil). This receipt's Shopify evidence shows the
`dropship-beauty` tag is on 24 products, including the mapped bundles. It is UNKNOWN whether
the three essentials carry that tag. Their placeholder change (`ff55a13`) still stands on its
own grounds: the images showed printed brand text that did not match the product sold.

### Presentation map review (all 17 entries, repo side)
| Handle | Public name | Image source | Status |
|---|---|---|---|
| body-wave-human-hair-bundles | Lawless Body Wave Bundles | repo `bundle-bodywave.jpg` | APPROVED, IMAGE REPAIR NEEDED: "LUXE CROWNS" ribbons; LAWLESS relabel prepared, not installed |
| deep-wave-human-hair-bundles | Lawless Deep Wave Bundles | repo `bundle-deepwave.jpg` | APPROVED + READY (plain ribbon, deep-wave texture) |
| loose-wave-human-hair-bundles | Lawless Loose Wave Bundles | repo `bundle-loosewave.jpg` | APPROVED, IMAGE REPAIR NEEDED: "LUXE CROWNS" and 3 crown marks; relabel prepared, not installed. TEXTURE QUESTION: the photo's broad S-wave looks like body wave |
| kinky-straight-human-hair-bundles | Flawless Kinky Straight Bundles | repo `bundle-kinkystraight.jpg` | APPROVED + READY (plain ribbon) |
| kinky-curly-human-hair-bundles | Kinky Curly Human Hair Bundles | placeholder | APPROVED, IMAGE REPAIR NEEDED: no kinky-curly image exists; placeholder kept |
| lawless-bone-straight-bundle-raw-vietnamese | Lawless Bone Straight Bundle — Raw Vietnamese | Shopify CDN | Off-brand "LUXE Hair Collection" card prop (not a ribbon; founder call) |
| royal-raw-indian-temple-bundle | Royal Raw Indian Temple Bundle | Shopify CDN | READY (plain gold ribbon) |
| lawless-4-4 / 5-5 closure, 13-4 frontal | Lawless … | Shopify CDN | Construction shown matches; no brand text seen |
| flawless-13-6 bob, u-part, 13-4 straight, glueless 4x4 | Flawless … | Shopify CDN | U-part image has a "…CROWNED" box and a logo bottle prop (founder call); others show no brand text |
| lawless-edge-control / lace-melt-spray / hair-oil | Lawless … | placeholder | Withheld by `ff55a13` |

The repo view is based on local copies. The CDN files were assumed to match their local
namesakes and were not fetched (egress blocked).

### Bundle deals and duplication (Tasks 5 and 6)
- Bundle deals, the other closures and frontals, lashes, Spanish Wave, Straight, Blonde, and Afro
  Kinky are **not in the allowlist**, so they are hidden. There is no public collision today, and none were added:
  each needs its exact Shopify handle and option titles, which are BLOCKED.
- Likely overlap once they are added: the manual-procurement closures, frontal, and bone straight
  (public, reportedly zero inventory) against Dropship Beauty-backed closures, frontals, and straight
  bundles (hidden). Smallest safe path: for each pair, keep one public handle. Point the JBH record
  at the stocked Shopify handle and drop the zero-stock one from the map (no deletion in Shopify).
  This needs the founder's choice per pair.
- A bundle deal must get its own JBH name ("… 3-Bundle Deal"), its own option list, and a hero image
  showing three bundles. It must never reuse the single-bundle photo.

### Changes this continuation
- `scripts/assets/relabel-bundle-ribbons.py` (`be6a46d`): founder-authorised ribbon relabel.
  Byte-reproducible output. Only the measured ribbon bands change: 3.4% / 2.6% of pixels.
  Outside the bands the drift is mean 0.05/255 with p99 <= 2, from JPEG re-encoding with the
  source's own tables. File size is at parity (126 KB vs 127 KB, 131 KB vs 132 KB).
  - Candidate sha256: bodywave `ba102cb7…67ba`, loosewave `59fc1f81…0424`.
  - Current live assets: bodywave `724cc5b2…6240`, loosewave `9e3961d9…e724`.
- Shopify records changed: none. Price, inventory, checkout: untouched.

### BLOCKED
1. **Shopify Admin for `8qp1z2-az`**: the connector was switched off the wrong store
   (`pd0vqx-eg` / show-appreciation-acceptance-deication) with founder approval. It now needs
   re-authorisation at claude.ai/customize/connectors and a new session. Until then there is
   no 24-product reconciliation: inventory, SKUs, Shopify media, and tags are all unavailable.
2. **Egress**: `jussbeautifulhair.com`, `cdn.shopify.com`, and `*.myshopify.com` return 403 from
   the agent environment. There is no production Playwright and no checkout handoff proof.
3. **Asset install**: overwriting `client/public/products/bundle-{bodywave,loosewave}.jpg` was
   refused by the agent permission classifier despite founder approval. The tool and its hashes
   are committed so the install can be reproduced exactly.

### Tests
The code and tests are unchanged since `66dfd67`. There, `npm test` ran 90/91; the one failure
(`browser history is authoritative…`) is pre-existing on `a2166f6`. Local Playwright
(`scripts/beauty-essentials-image-playwright.mjs`) passes desktop and mobile. It is mocked-catalog
proof only, not production.

### Rollback
- Tool: `git revert be6a46d`.
- Earlier essentials placeholder: `git revert 66dfd67 ff55a13`.
- If the relabelled assets are installed later, revert that commit to restore the originals
  (still in git history).

### Next gate
1. Founder: reconnect Shopify to the JBH store and allow egress to `jussbeautifulhair.com`
   (environment network settings), then start a new session on this branch.
2. That session: install the two relabelled assets from `be6a46d` and reconcile the 24 tagged
   products. Add approved deals, closures, and straight bundles as explicit allowlist records.
   Then run production Playwright through the Shopify checkout handoff (no payment).
3. Founder decisions: loose-wave texture accuracy; the bone-straight card and U-part box props;
   and one handle per overlapping manual / Dropship Beauty pair.
