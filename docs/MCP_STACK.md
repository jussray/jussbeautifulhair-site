# Juss Beautiful Hair storefront MCP stack

Last reviewed: 2026-07-16

This repository is the public storefront and Cloudflare checkout surface. Its default MCP stack is limited to source control, current documentation, deployment evidence, and isolated browser verification.

## Connected servers

| Server | Purpose | Boundary |
| --- | --- | --- |
| `github` | Repository, pull requests, Actions, code scanning, and secret scanning | Selected toolsets only; lockdown enabled while this repository is public |
| `context7` | Current documentation for Vite, React, Stripe SDK, Drizzle, Neon, TypeScript, and related libraries | Documentation only; never include customer, order, payment, or credential data |
| `cloudflare-docs` | Current Cloudflare product documentation | Documentation only |
| `cloudflare-builds` | Inspect Pages and Worker build evidence | OAuth; no deployments or setting changes without explicit approval |
| `cloudflare-observability` | Inspect Worker logs and runtime errors | Do not copy customer PII, checkout payloads, Stripe signatures, or secrets into prompts |
| `playwright` | Test the storefront and checkout handoff at browser and phone widths | Pinned package, isolated Chromium profile, synthetic checkout data only |

## Deliberately excluded

- Direct Supabase or generic database MCP access. This public repository does not need a standing database control channel.
- DBHub. Add it only for a bounded, read-only database investigation with a private local configuration and an explicit removal condition.
- Netdata. Cloudflare is the current owned runtime surface; there is no persistent server fleet to monitor.
- GitHub Insiders mode and the local Docker GitHub server as committed defaults.
- Unpinned MCP packages or `@latest` bridges.
- Stripe secret keys, webhook signing secrets, Cloudflare tokens, database URLs, or PATs in repository configuration.

## Stripe boundary

MCP tools may inspect code and synthetic fixtures. They must never receive real card data, Checkout session payloads, customer addresses, webhook signatures, or production event bodies. Stripe webhook changes still require signature verification, idempotent processing, failure recording, and deployment evidence.

## Verification prompts

```text
Use GitHub MCP to inspect the current checkout Worker and report the exact code path from catalog selection to Stripe Checkout. Do not change anything.
```

```text
Use Context7 to verify the installed Stripe SDK and Drizzle APIs before proposing code changes. Use the versions in package.json and package-lock.json.
```

```text
Use Cloudflare Builds and Observability to identify the latest storefront and checkout-worker deployment state. Do not deploy or change settings.
```

```text
Use Playwright in an isolated Chromium profile to test the storefront at phone width with synthetic data. Do not complete a real purchase or submit real customer information.
```

## Validation

Run:

```bash
npm run verify:mcp
npm run check
npm run build
```

A connected MCP server is not release evidence. GitHub checks, Cloudflare deployment metadata, synthetic checkout verification, and a deliberate founder review remain authoritative.
