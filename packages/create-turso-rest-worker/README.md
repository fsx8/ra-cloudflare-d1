# create-turso-rest-worker

CLI scaffolding tool for a Turso (libSQL) REST Worker.

```bash
npx create-turso-rest-worker
```

Use `--auto-discover` to introspect a Turso database directly over libSQL using
your connection URL and auth token (no Cloudflare API needed).

After scaffolding:

```bash
cd turso-rest-worker
pnpm install
pnpm exec wrangler secret put API_KEY
pnpm exec wrangler secret put TURSO_AUTH_TOKEN
pnpm run deploy
```

`TURSO_CONNECTION_URL` is written to `wrangler.jsonc` as a non-secret var (it is
not sensitive); `TURSO_AUTH_TOKEN` and `API_KEY` are secrets.
