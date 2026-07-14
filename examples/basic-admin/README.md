# basic-admin example

`admin/` is a minimal React-Admin app configured with `ra-cloudflare-d1`.

`worker/` is a Cloudflare Worker using `d1-rest-worker`.

## Run locally

From the repo root:

```bash
pnpm install
pnpm --filter basic-admin-worker exec wrangler secret put API_KEY
pnpm --filter basic-admin-worker dev
```

In another terminal:

```bash
pnpm --filter basic-admin dev
```

When prompted for `API_KEY`, you can use `sk_replace_me` (the default `VITE_API_KEY` in the admin app) or set both to the same custom value.
