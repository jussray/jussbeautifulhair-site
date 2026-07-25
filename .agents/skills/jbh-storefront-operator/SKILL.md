---
name: jbh-storefront-operator
description: Operate the public Juss Beautiful Hair storefront using 5W1H, exact evidence, public-private separation, proportional verification, and reversible founder-gated changes.
---

# jbh-storefront-operator

## Trigger

Use for every nontrivial task, repository-state claim, code or documentation change, deployment discussion, review, or recovery operation in `jussray/jussbeautifulhair-site`.

## 5W1H operating contract

Before planning, editing, or claiming completion, establish and state:

- **Who** — the requester, decision owner, affected users, data subjects, and execution authority.
- **What** — the requested outcome, concrete deliverable, non-goals, and existing work that must be preserved.
- **Where** — the exact repository, branch, environment, runtime, route, service, data store, and provider boundary.
- **When** — the current lifecycle or release state, required ordering, timing constraint, and rollback window.
- **Why** — the user problem and verified evidence that justify the work.
- **How** — the smallest safe implementation, required permissions, verification evidence, rollout, and rollback.

Inspect repository and runtime truth for unknowns. Ask only when a missing answer materially changes the safe solution or authority. Re-run 5W1H after red-team/OODA findings change the plan. Finish by mapping the result, evidence, remaining blocker, and next owner back to all six questions.

## Repository identity

**Repository:** `jussray/jussbeautifulhair-site`

**Role:** The public React/Vite storefront and minimal Cloudflare payment-session Worker for jussbeautifulhair.com.

This is a reviewed orientation, not permanent truth. Re-read the current README, branch, recent commits, workflows, configuration, and runtime evidence before acting.

## Non-negotiable boundaries

- Keep private admin pages, owner authentication, vendor sourcing, pricing, outreach, customer exports, and private control data in jbh-private only.
- Keep Stripe keys, webhook secrets, Cloudflare tokens, and environment files out of browser bundles and source.
- Preserve production-only Cloudflare configuration and deployment-boundary checks.
- Do not add public preview paths or a second deployment authority.
- Treat checkout, payment, and customer data changes as security-sensitive.

## Required loop

1. Observe the exact branch, changed files, existing implementation, data boundaries, and available evidence.
2. Complete 5W1H and identify any authority or safety gap.
3. Red-team the premise, privacy, security, misuse, failure modes, and rollback.
4. Choose the smallest reversible action that preserves existing work.
5. Implement only within the confirmed repository role.
6. Run proportionate checks on the exact head.
7. Report what is proven, what is inferred, what remains blocked, and who owns the next action.

## Verification

- `npm run quality`
- `npm run verify:deploy`
- `npm run verify:mcp`

A command listed here is a starting point, not proof it exists or applies forever. Discover current scripts and workflows first. A skipped, stale, unstarted, or older-SHA check is not a pass.

## Output

Return:

- the completed Who / What / Where / When / Why / How;
- exact repository, branch, and head SHA;
- files and boundaries touched;
- executed checks and evidence;
- preserved work;
- rollback path;
- blocker and next owner.

Never promote a prototype, demo, archive, duplicate, local check, or provider registration into a production claim without exact runtime evidence.
