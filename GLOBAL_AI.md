# Juss Beautiful Hair Global AI Contract

This repository follows the shared founder stack:

```text
/garyvee lindymode redteam l99 redteam ooda
```

Repeated `redteam` tokens are intentional.

1. **GaryVee frame** — define the customer, offer, trust proof, distribution path, and fastest truthful conversion signal.
2. **Lindy screen** — prefer standard commerce primitives, clear policies, portable product data, simple integrations, and reversible theme changes.
3. **Redteam I: premise** — attack product claims, pricing assumptions, inventory truth, payment flow, customer trust, privacy, and whether the change should exist.
4. **L99 systems pass** — inspect catalog ownership, price and inventory state, checkout handoff, order notification, fulfillment, customer data, deployment, versioning, and rollback.
5. **Redteam II: plan** — attack the selected implementation for broken links, stale prices, exposed secrets, misleading stock, checkout failure, inaccessible UX, and recovery gaps.
6. **OODA** — re-observe, orient, decide one scoped change, act minimally, verify the customer path, and loop.

Do not collapse the two redteam passes. The first attacks the commercial premise. The second attacks the implementation chosen to serve it.

## Truth order

1. Repository, live storefront, Cloudflare configuration, Stripe configuration, and current product data actually inspected.
2. Current builds, tests, checkout behavior, notifications, logs, and observed customer path.
3. Explicit founder decisions and approved prices, policies, products, and brand records.
4. Current official provider documentation.
5. Prior summaries, generated plans, chat memory, and assumptions.

Never claim a product, price, discount, stock state, payment, order, shipment, deployment, or customer notification exists without evidence.

## Storefront boundaries

- This repository is the public storefront. Public code must not contain Stripe secret keys, webhook secrets, supplier credentials, private admin controls, customer records, or hidden vendor documentation.
- Stripe Payment Links and other hosted checkout links must be verified against the intended product, price, currency, and environment.
- Cloudflare build success is not proof that checkout, order notification, inventory, fulfillment, or customer support paths agree.
- Product names, descriptions, images, pricing, availability, shipping, returns, and claims must reflect approved business truth.
- Administrative and supplier operations belong in private, access-controlled systems.
- Do not imply luxury affiliation, authenticity, health outcomes, guaranteed results, stock, or shipping speed that has not been verified.

## Provider roles

- **Claude / Claude Code** — repository analysis, focused implementation, storefront audits, and documentation.
- **Codex / ChatGPT** — debugging, code review, tests, data analysis, repository operations, and founder-readable decisions.
- **OpenAI Platform** — optional server-side AI capability behind a secure adapter; never a client-side key.
- **Anthropic Platform** — optional server-side AI capability behind a secure adapter; model context is not customer or catalog memory.
- **Perplexity** — current public research, competitor scans, policy and platform research, not private store truth.
- **GitHub** — source, review, CI evidence, and rollback.
- **Cloudflare** — static hosting and deployment boundary for this storefront.
- **Stripe** — payment boundary; hosted links, prices, events, and order implications require verification.

## Non-negotiable rules

- Inspect existing products, links, pages, build output, and deployment settings before editing.
- Keep secret and administrative values off the client and out of commits.
- Do not weaken accessibility, type checks, tests, checkout validation, or security to make a build green.
- Do not silently change prices, products, shipping, returns, discounts, domains, payment behavior, or live deployment targets.
- Prefer focused changes over broad visual or platform rewrites.
- Preserve mobile usability and customer clarity.
- Separate public storefront content from private supplier and operational records.

## Approval gates

Require explicit founder approval before:

- merge, force-push, production deploy, or rollback;
- changing live prices, products, discounts, availability, shipping, returns, or checkout links;
- changing Stripe, Cloudflare, domains, DNS, environment variables, or credentials;
- adding analytics, tracking, customer messaging, or third-party apps with data access;
- publishing supplier, customer, order, or administrative information;
- sending external communications in the founder’s name.

An audit authorizes inspection, not mutation.

## Required report

1. Reality
2. Risk I: premise
3. L99 commerce view
4. Decision
5. Risk II: selected plan
6. Action
7. Proof
8. Rollback
9. Next approval gate

A storefront is not finished because the homepage is pretty. Commerce waits until money moves before revealing which assumptions were imaginary.