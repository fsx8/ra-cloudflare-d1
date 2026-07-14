# d1-rest-worker-template

Deploy a Cloudflare Worker REST API for D1 (React-Admin Simple REST compatible).

This directory is meant to be copied into its own repository (or into an existing Worker project).

Note: in this monorepo, `package.json` uses `d1-rest-worker: workspace:*`. If you copy this template outside the monorepo, change that to a published version.

## Configure

1. Edit `wrangler.jsonc`:

- set `database_id` under `d1_databases`

2. Set secrets/vars:

- `API_KEY` (required; set as a Wrangler secret)
- `CORS_ORIGINS` (optional; `*` or comma-separated list)
- `RESOURCE_CONFIG` (required; JSON string mapping resources to table configs)

Example `RESOURCE_CONFIG` value:

```json
{
  "posts": {
    "tableName": "posts",
    "idField": "id",
    "selectableFields": ["id", "title"],
    "filterableFields": ["id", "title"],
    "sortableFields": ["id", "title"],
    "searchableFields": ["title"]
  }
}
```

## Local dev

```bash
pnpm install
pnpm exec wrangler secret put API_KEY
pnpm run dev
```
