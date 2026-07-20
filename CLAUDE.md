# Claude Operating Contract — jussbeautifulhair-site

This file governs Claude (claude.ai, Claude Code, MCP-connected Claude sessions) when working in `jussray/jussbeautifulhair-site`.

## 5W1H — Required Before Every Nontrivial Action

- **Who** — requester, decision owner, affected users, data subjects, execution authority.
- **What** — requested outcome, concrete deliverable, non-goals, existing work to preserve.
- **Where** — `jussray/jussbeautifulhair-site`, exact branch, environment, runtime, route, service, and deployment boundary.
- **When** — current lifecycle/release state, ordering, timing constraint, rollback window.
- **Why** — verified user problem and evidence.
- **How** — smallest safe implementation, permissions, verification, rollout, rollback.

## Repository Identity

**Repository:** `jussray/jussbeautifulhair-site`
**Role:** Public React/Vite storefront + minimal Cloudflare payment-session Worker for jussbeautifulhair.com.
**Separation:** Private admin, vendor sourcing, order records, and credentials live in `jbh-private`. This repo contains public catalog and storefront code only.

## Non-Negotiable Boundaries

- Keep private admin pages, vendors, costs, sourcing records, customer/order exports, credentials, and strategy in `jbh-private`.
- Keep Juss Beautiful Hair and Untold Stories catalogs, customers, suppliers, checkout, and fulfillment separate.
- The Cloudflare payment-session Worker is the only checkout authority — do not add alternate checkout surfaces.
- Never use dark patterns, deceptive urgency, unsupported claims, or private customer content for persuasion.
- All production deploys require explicit founder approval.

## Skills to Load

- `.agents/skills/jbh-storefront-operator/SKILL.md` — 5W1H, public-storefront identity, proof, rollback
- `.agents/skills/sales/SKILL.md` — positioning, merchandising, offer clarity
- `.agents/skills/devil/SKILL.md` — premise attacks before commercial changes
- `.agents/skills/figma-build-implement/SKILL.md` — for any Figma or design task

## Required Loop

1. Observe exact branch, files, implementation, and deployment boundary.
2. Complete 5W1H and identify authority or safety gaps.
3. Red-team the premise, privacy, checkout authority, and rollback.
4. Choose smallest reversible action preserving existing work.
5. Implement within confirmed repository role.
6. Run typecheck, lint, unit/contract tests, production build, Playwright desktop/mobile.
7. Report proven, inferred, blocked, and next owner.

## Approval Gates

Require explicit founder approval before: merging, deploying, changing pricing/discounts/catalog, rotating secrets, domain changes, or customer communications.

## Output Format

Return: completed 5W1H · repo/branch/SHA · files touched · checks run · preserved work · rollback path · blocker and next owner.
