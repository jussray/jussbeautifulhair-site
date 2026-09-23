# Beauty Essentials image repair — 2026-09-23

Public, supplier-neutral receipt. Supplier identity, sourcing evidence, and the full
VERIFIED / INFERRED / UNKNOWN / BLOCKED ledger live in the private receipt:
`jbh-private/docs/verification/dropship-beauty-image-repair-20260923.md`.

## Scope
- Repo: `jussray/jussbeautifulhair-site`, branch `claude/dropship-beauty-images-qqlu53`
- Base SHA: `a2166f686b19e082ddb5033d1e38eb62c01e4e00`
- Store authority (unchanged): `8qp1z2-az.myshopify.com`, Storefront API `2026-07`, vendor `JBH`
- Handles changed (presentation only): `lawless-edge-control-4-oz`,
  `lawless-lace-melt-spray`, `lawless-hair-oil-rosemary-mint`
- Handles inspected, unchanged: the 13 other entries in `JBH_PRESENTATION_BY_HANDLE`

## Finding
The storefront image for each of the three handles comes only from
`client/src/lib/shopifyCatalog.ts` (the presentation allowlist overrides Shopify
`featuredImage`). Each bound asset shows printed brand text that does not match the
product name sold ("Luxe" edge control, crest-labelled "Lace Melt", "LUXÉLUNE Hair"
oil vs. "Lawless …"), and does not depict the sticker-labelled container the
fulfillment lane ships. Also: `edge-control.jpg` is 800×533 (lowest resolution in set).

## Fix
`image: ""` for the three handles, so ProductCard, PDP, Home, Cart, and Checkout
summary render the existing "Product image updating" placeholder (same fail-closed
pattern as `kinky-curly-human-hair-bundles`, commit `0045602`). No files deleted;
`client/public/products/*.jpg` and Shopify Files are untouched.

## Proof
- `node --test tests/shopify-brand-firewall.test.mjs`: new guard fails on base source, passes on fix.
- `npm run lint` (tsc + storefront lint): pass.
- `npm test`: 90/91; the 1 failure (`browser history is authoritative while legacy entry
  routes migrate forward`) fails identically on the untouched base SHA. It predates this change.
- `node scripts/beauty-essentials-image-playwright.mjs` (local Vite, mocked Worker catalog
  payload): desktop 1440×1100 + mobile 390×844. Shop cards, PDP, add-to-cart, and cart rows show
  the placeholder. The withheld assets and raw Shopify image are never requested, the approved
  bundle image loads (naturalWidth 800), and there is no horizontal overflow.
  Evidence: `artifacts/beauty-essentials-images/`.

## Not proven
- Live `jussbeautifulhair.com`: not reachable from the agent environment (egress policy 403).
- Shopify admin product media / Shopify-hosted checkout thumbnails: no connector to the JBH shop.

## Rollback
`git revert <fix commit>` restores the three prior CDN image URLs.

## Next gate
The founder decides between keeping the placeholder and supplying a real photo of the
sticker-labelled product. To restore an image, set `image` and update the guard test in the same commit.
