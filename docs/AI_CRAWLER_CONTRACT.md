# AI Crawler Contract v1

Automated access is a governed public product surface, not an automatic license to copy everything.

## Default intent
- Allow reputable search/discovery crawlers on intentionally public canonical pages.
- Allow reputable user-directed assistants to fetch intentionally public pages.
- Deny model-training and bulk dataset collection by default.
- Keep private prompts, provider responses, logs, credentials, Company Brain state, drafts, and governance-only material outside crawler scope.
- Prefer canonical citation/source links and qualified referral traffic when supported.
- Crawler access is read-only and never grants execution, publication, merge, deployment, billing, credential, or founder authority.

## Provider split
| Purpose | Bot/token | Default |
| --- | --- | --- |
| OpenAI search | `OAI-SearchBot` | allow public pages |
| OpenAI user fetch | `ChatGPT-User` | allow public pages |
| OpenAI training | `GPTBot` | deny |
| Anthropic search | `Claude-SearchBot` | allow public pages |
| Anthropic user fetch | `Claude-User` | allow public pages |
| Anthropic training | `ClaudeBot` | deny |
| Google Search | `Googlebot` | allow public pages |
| Google Gemini extended use | `Google-Extended` | deny by default |

Re-verify provider documentation before changing production policy.

## Public machine surfaces
When the deployment supports them, publish `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/crawlers.json` from public-safe truth only. Chief's public explanation must remain bounded by `PUBLIC_FACE.md` and `public-face.html`; internal application state is not crawler inventory.

## Economic layer
If Cloudflare AI Crawl Control / Pay Per Crawl is actually available and enabled for a verified domain, keep discovery metadata free, allow crawlers that produce referral/search value, block policy violators, and consider charging other AI crawler access. Never claim paid crawling is active without provider evidence.

## Security invariant
`robots.txt` is preference, not access control. Authentication and server-side authorization remain the security boundary.
