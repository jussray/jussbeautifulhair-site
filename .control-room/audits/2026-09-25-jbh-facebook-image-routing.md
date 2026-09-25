# JBH Facebook Image Routing Audit — 2026-09-25

## Scope
Audit and repair the source of off-brand imagery appearing on the Juss Beautiful Hair Facebook Page while preserving approved post copy.

## Fingerprint
- Storefront repo: `jussray/jussbeautifulhair-site`
- Audited storefront main: `489f364d2a7fe42c96c0ad7614ab3bac4f9b6b4e`
- Metricool brand: `Juss Beautiful Hair` (`6877829`)
- Facebook publisher observed: Metricool
- Facebook Page connection observed in Metricool: `235882889600658`
- Audit date: 2026-09-25

## TRUE baseline
- The post copy was not the defect.
- The off-brand visual media was entering through Metricool scheduled-post media attachments.
- No repository-side Metricool/Facebook scheduler was found in `jussbeautifulhair-site` or `founder-control-room` during this audit.
- `client/src/lib/shopifyCatalog.ts` remains the JBH presentation authority for customer-facing product imagery.
- The four complete bundle-deal handles intentionally have `image: ""` because no reviewed customer-safe three-bundle imagery is approved yet. Their comments explicitly forbid leaking off-brand or misleading packaging.
- `Juss Hair Match Session + $25 Purchase Credit` has an approved Shopify image.

## Repair applied to pending Facebook queue
Copy was preserved exactly. Only media routing changed.

1. Deep Wave complete bundle deal — 2026-09-26 10:00 America/New_York
   - Metricool UUID: `5267436722727897832`
   - Old media: removed
   - New state: text-only Facebook post
   - Reason: no approved exact three-bundle image exists.

2. Loose Wave complete bundle deal — 2026-09-27 10:00 America/New_York
   - Metricool UUID: `-884202229092891164`
   - Old media: removed
   - New state: text-only Facebook post
   - Reason: no approved exact three-bundle image exists.

3. Complete Install Bundle Deals budget guide — 2026-09-28 10:00 America/New_York
   - Metricool UUID: `4606041476763304994`
   - Old four-image carousel: removed
   - New state: text-only Facebook post
   - Reason: the promoted complete-deal handles do not yet have approved exact product imagery.

4. Hair Match — 2026-09-29 10:00 America/New_York
   - Metricool UUID: `8675188167410534601`
   - Old Metricool promo art: replaced
   - Approved authority: Shopify product image for `juss-hair-match-session-25-purchase-credit`
   - Approved source at repair time: `https://cdn.shopify.com/s/files/1/0845/7604/3251/files/jbh-hair-match-session_a5ec129d-bb15-401a-b5ce-b77046505360.png?v=1786302718`
   - Metricool re-hosted the approved asset after update, which is expected.

## Standing Facebook visual-routing rule
For JBH Facebook organic posts:
1. Preserve the approved caption independently from media selection.
2. Product imagery must resolve from the approved JBH storefront presentation map or a Shopify product image that is explicitly approved for that exact product.
3. If the presentation map intentionally has a blank image, publish text-only or hold for an approved campaign asset. Do not substitute a different texture, single bundle, closure, frontal, wig, supplier photo, or generated generic beauty graphic.
4. Campaign art may be used only when explicitly approved as JBH campaign art and when it does not misrepresent the product being sold.
5. Never infer image authority from a product title, filename, Metricool media slot, or the mere existence of a Shopify image.
6. Facebook media changes must be verified by Metricool readback before calling the fix complete.

## Published-history limitation
The already-published 2026-09-24 Body Wave Facebook post and 2026-09-25 Straight Facebook post retain their previously published media. The connected Metricool actions available in this session can update scheduled posts but do not expose mutation of already-published Facebook posts. Do not claim those historical posts were edited.

## Proof
Post-update Metricool readback showed:
- Deep Wave Facebook: PENDING, no media
- Loose Wave Facebook: PENDING, no media
- Budget-guide Facebook: PENDING, no media
- Hair Match Facebook: PENDING, approved Hair Match asset present through Metricool media storage

## Rollback
Each pending Metricool post retains the same UUID. Media can be changed again without rewriting the caption. Re-attach media only when a product-exact JBH-approved asset is proven.

## Task accuracy
- Requested intent: fix off-brand pictures without changing the text.
- Result: VERIFIED for the remaining scheduled Facebook queue.
- Published historical Facebook posts: NOT MODIFIED.
- TikTok and Instagram scheduled media: OUT OF SCOPE for this repair and intentionally left unchanged.
