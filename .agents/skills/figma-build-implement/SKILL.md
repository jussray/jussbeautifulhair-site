---
name: figma-build-implement
description: Build and implement the public Juss Beautiful Hair storefront through Figma while preserving the catalog, Cloudflare checkout boundary, brand moat, and separation from private operations.
---

# Juss Beautiful Hair Public Figma Build + Implementation

Load for every Figma, storefront design, design-system, design-to-code, responsive QA, component mapping, or visual handoff task in this repository.

## Tool skills

- Load `figma-use` before every Figma write.
- Load `figma-generate-library` for tokens, variables, components, variants, themes, or design-system reconciliation.
- Use `figma-generate-design` only for first capture of a running storefront page into an existing file; rebuild editable structure with `figma-use`.
- Use `figma-code-connect` only for published components with exact node URLs, plan eligibility, and verified React props.

## Repository profile

- Runtime: public React/Vite storefront plus minimal Cloudflare payment-session Worker.
- Primary design targets: homepage, catalog, product detail, About/story, quality/care/proof moat, cart and checkout handoff, success/error states, mobile and desktop.
- Implement in existing React/Vite components and current styling conventions. Preserve the active Cloudflare-only checkout boundary.
- The public Figma library must contain public brand/product content only.

## Required sequence

1. Run 5W1H and verify current catalog, routes, deployment boundary, and open product work.
2. Redteam the premise: brand drift, unsupported sourcing claims, inaccessible commerce, checkout confusion, accidental admin/vendor exposure, and Untold Stories catalog leakage.
3. Inspect existing React components, catalog source, styles/tokens, responsive behavior, tests, and Figma libraries.
4. Lock page/state scope, catalog assumptions, implementation files, responsive breakpoints, and proof.
5. Reuse current components and design-system assets before creating new ones. Preserve the hair visual identity and Story/Quality/Care/Proof layers.
6. Implement in the current public storefront. Do not add admin, order lookup, vendor, sourcing, database, or alternate deployment surfaces.
7. Redteam the selected implementation: exact product count, signature product, negative catalog leakage, checkout authority, privacy, performance, accessibility, and rollback.
8. Verify with typecheck, lint, unit/contract tests, production build, Playwright desktop/mobile, and deployment-boundary checks.
9. Record Figma nodes, code mappings, screenshots/traces, unresolved drift, rollback, and next founder gate.

## Data and authority boundary

- Never place customer/order data, vendor identities, vendor prices, sourcing records, Stripe secrets, webhook data, private admin controls, or unpublished business strategy into Figma.
- Use public catalog data and synthetic checkout states only.
- A Figma checkout interaction does not authorize price, product, promotion, payment, Worker, route, domain, or deployment changes.
- Keep Untold Stories products and operations separate.

## Code Connect

Map only published reusable public storefront components with verified React props. Map variants exhaustively and keep checkout/server behavior out of visual component mappings.

## Definition of done

Editable design, implementation status, catalog and boundary checks, responsive/accessibility proof, exact tests, known differences, rollback, and next gate are documented. A polished storefront mockup is not checkout or deployment proof.
