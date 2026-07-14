# Juss Beautiful Hair storefront — MCP and GitHub Models

## MCP servers

- **GitHub:** repository, pull-request, Actions, and security evidence with lockdown mode.
- **Bright Data:** VS Code/Codespaces only, prompted at runtime for `API_TOKEN`, and restricted to `GROUPS=code` for current npm and PyPI package metadata. It is not enabled for product scraping, competitor monitoring, customer research, browser automation, or ecommerce collection.
- **Microsoft Learn:** current official Microsoft technical documentation and code samples; no authentication required.
- **Figma:** approved storefront frames, variables, and design context.
- **Cloudflare Docs, Builds, and Observability:** documentation and release evidence for the Cloudflare Pages storefront.
- **Playwright:** pinned, isolated Chromium for responsive storefront and checkout-boundary verification.

No generic database MCP is connected. The public storefront must not gain broad access to private vendor or admin systems.

The committed root `.mcp.json` remains credential-free. MCP hosts other than VS Code/Codespaces must configure Bright Data locally and keep the API token outside the repository. Bright Data Pro Mode and broad browser, ecommerce, and web-data groups are intentionally disabled.

## GitHub Models

GitHub Models is used for synthetic storefront-copy and guardrail evaluation, not checkout execution.

- The manual workflow uses the automatic `GITHUB_TOKEN` with only `contents: read` and `models: read`.
- Local or Codespaces use may store a fine-grained `models:read` PAT as `GITHUB_MODELS_TOKEN`.
- Tokens never belong in source, Vite variables, `.mcp.json`, issues, or pull requests.

Allowed inputs are public catalog copy, invented product fixtures, public brand guidance, and synthetic checkout responses. Do not send Stripe secrets, webhook secrets, customer identity, addresses, orders, payment details, private vendor data, wholesale pricing, or admin credentials.

A model may review copy or flag a checkout-boundary violation. It may not create prices, issue refunds, change products, publish the site, or approve a production release.
