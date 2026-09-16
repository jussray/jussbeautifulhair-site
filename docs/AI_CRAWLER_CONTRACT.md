# AI Crawler Contract v1

Juss Beautiful Hair treats automated access as a commercial discovery surface, not an automatic training license.

## Default intent
- Search/discovery crawlers may index intentionally public storefront pages and product information.
- User-directed assistants may retrieve intentionally public storefront information to help a shopper find the store or product.
- Model-training and bulk dataset collection are denied by default.
- Checkout, session, API, customer, payment, admin, internal and secret-bearing surfaces are not crawler inventory.
- Crawlers have read-only public access and never gain checkout, payment, publication, credential or founder authority.
- Canonical links and source attribution are requested when supported.

## Bot split
| Purpose | Bot/token | Default |
| --- | --- | --- |
| OpenAI search | `OAI-SearchBot` | allow public storefront |
| OpenAI user fetch | `ChatGPT-User` | allow public storefront |
| OpenAI training | `GPTBot` | deny |
| Anthropic search | `Claude-SearchBot` | allow public storefront |
| Anthropic user fetch | `Claude-User` | allow public storefront |
| Anthropic training | `ClaudeBot` | deny |
| Google Search | `Googlebot` | allow public storefront |
| Google Gemini extended use | `Google-Extended` | deny by default |

The Worker already emits `Content-Signal: ai-train=no, search=yes, ai-input=no` on public asset responses. `robots.txt` is policy, not authentication.

If Cloudflare AI crawler charging is later enabled for the verified production zone, keep discovery/value-producing crawlers accessible and only charge crawler classes where the provider supports it and real referral/search value is not harmed.
