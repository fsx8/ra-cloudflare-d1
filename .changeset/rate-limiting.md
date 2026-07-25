---
"@ra-cloudflare-d1/types": minor
"d1-rest-worker": minor
---

Add optional rate limiting via Cloudflare's native Rate Limiting binding. Pass `rateLimit: { binding: env.API_RATE_LIMITER }` to `createD1RestApi` to enforce per-key request limits with zero latency overhead. Returns `429 RATE_LIMITED` when exceeded.
