# advanced-admin example

A more feature-complete example showing:

- custom list filters (`filter.q`, operator suffixes, and `_includeDeleted`)
- create/edit forms
- multiple resources (`posts`, `users`)

## Run locally

From the repo root:

```bash
pnpm install
pnpm --filter advanced-admin-worker exec wrangler secret put API_KEY
pnpm --filter advanced-admin-worker dev
```

In another terminal:

```bash
pnpm --filter advanced-admin dev
```

When prompted for `API_KEY`, you can use `sk_replace_me` (the default `VITE_API_KEY` in the admin app) or set both to the same custom value.

## Database schema

See `examples/advanced-admin/worker/schema.sql` for a starter schema/seed script you can apply to your D1 database.
