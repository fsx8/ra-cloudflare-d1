# Deployment Options

## Option A: CLI scaffolding (recommended)

```bash
npx create-d1-rest-worker
```

Then (inside the generated project):

```bash
pnpm install
pnpm exec wrangler secret put API_KEY
pnpm run deploy
```

## Option B: GitHub/Cloudflare template

Use `templates/worker-template` as a starting point. Configure:

- `DB` (D1 binding)
- `API_KEY` (Bearer token, set as a Wrangler secret)
- `CORS_ORIGINS`
- `RESOURCE_CONFIG` JSON
- Optional: uncomment the `ratelimits` binding in `wrangler.jsonc` to enable rate limiting

## Option C: Manual Worker setup

```ts
import { createD1RestApi } from "d1-rest-worker";

export default {
  fetch(request, env, ctx) {
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: ["https://admin.example.com"],
      resources: {
        posts: {
          tableName: "posts",
          idField: "id",
          selectableFields: ["id", "title"],
          filterableFields: ["id", "title"],
          sortableFields: ["id", "title"],
          searchableFields: ["title"],
        },
      },
    }).fetch(request, env, ctx);
  },
};
```
