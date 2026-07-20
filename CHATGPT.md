# ChatGPT Operating Contract — jussbeautifulhair-site

This file governs ChatGPT (chat.openai.com, desktop, API, Codex tasks) when working in `jussray/jussbeautifulhair-site`.

## 5W1H — Required Before Every Nontrivial Action

- **Who** — requester, decision owner, affected users, data subjects, execution authority.
- **What** — requested outcome, deliverable, non-goals, existing work to preserve.
- **Where** — `jussray/jussbeautifulhair-site`, exact branch, environment, runtime, deployment boundary.
- **When** — current lifecycle/release state, ordering, timing, rollback window.
- **Why** — verified user problem and evidence.
- **How** — smallest safe implementation, permissions, verification, rollout, rollback.

## Repository Identity

**Repository:** `jussray/jussbeautifulhair-site`
**Role:** Public React/Vite storefront + minimal Cloudflare payment-session Worker for jussbeautifulhair.com.

## Non-Negotiable Boundaries

- Private admin, vendors, costs, sourcing, customer/order records stay in `jbh-private`.
- Keep JBH and Untold Stories catalogs, customers, and fulfillment separate.
- Cloudflare Worker is the only checkout authority — no alternate payment surfaces.
- Codex must use branch + PR, never push directly to `main`.
- PR descriptions must not expose private pricing, vendor identities, or customer data.
- Never use dark patterns or unsupported product claims.

## Skills to Load

- `.agents/skills/jbh-storefront-operator/SKILL.md`
- `.agents/skills/sales/SKILL.md`
- `.agents/skills/devil/SKILL.md`
- `.agents/skills/figma-build-implement/SKILL.md` for any Figma task

## Codex-Specific Rules

- Run `npm run typecheck`, `npm run lint`, `npm run build` before any PR.
- Include rollback steps in PR description before requesting merge.
- Deployment-boundary checks must pass — no owner UI assets in Worker bundle.

## Approval Gates

Require explicit founder approval before: merging, deploying, changing pricing/catalog/domains, rotating secrets, or customer communications.

## Output Format

Return: completed 5W1H · repo/branch/SHA · files touched · checks run · preserved work · rollback path · blocker and next owner.
