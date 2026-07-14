# create-d1-rest-worker

CLI scaffolding tool for a D1 REST Worker.

```bash
npx create-d1-rest-worker
```

Use `--auto-discover` to introspect a D1 database via Cloudflare API token.

After scaffolding:

```bash
cd d1-rest-worker
pnpm install
pnpm exec wrangler secret put API_KEY
pnpm run deploy
```
