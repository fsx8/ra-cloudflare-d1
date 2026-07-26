---
"rest-worker-types": minor
"core-rest-worker": minor
"turso-rest-worker": minor
"d1-rest-worker": minor
---

Two backward-compatible changes from integration feedback (mounting the REST
worker inside an existing host worker):

- **Inject a pre-built client/adapter.** `createTursoRestApi` now accepts
  `{ client }` (reuse a caller-owned `@libsql/client` `Client` — avoids a second
  connection pool) or `{ adapter }` (any `RestWorkerDb`, the lowest-level escape
  hatch) in addition to `{ url, authToken }`. `createD1RestApi` now accepts
  `{ adapter }` in addition to `{ dbBinding }`. Both packages export their
  `createXxxAdapter` and re-export `RestWorkerDb` for composition.
- **Optional API key.** `RestWorkerConfig.apiKey` is now optional, guarded by a
  new `requireApiKey` flag (defaults to `true`, so existing behavior is
  unchanged). Set `requireApiKey: false` to skip bearer auth entirely — for
  workers fronted by a trusted authenticating proxy (Cloudflare Access, a
  gateway, …). `createRestApp` fails fast at construction if auth is on but no
  `apiKey` is supplied.
