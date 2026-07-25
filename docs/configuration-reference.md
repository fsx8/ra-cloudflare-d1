# Configuration Reference

## Worker (`d1-rest-worker`)

`createD1RestApi(config)` accepts:

- `apiKey`: Bearer token required for all requests
- `corsOrigins`: `'*'` or array of allowed origins — **use a whitelist** (`['https://admin.example.com']`) in production so browsers block cross-origin requests; `'*'` is fine for local dev only
- `basePath`: optional base path (default `/api`)
- `enableSchemaEndpoint`: defaults to `true`
- `maxPerPage`: optional cap on the number of rows returned by a list request (default `1000`). Protects the worker from materializing huge result sets; ranges beyond this are clamped.
- `rateLimit`: optional — `{ binding: env.MY_RATE_LIMITER }` to enable. Requires a `ratelimits` binding in your `wrangler.jsonc`. The default key is the Bearer token from the `Authorization` header (falls back to `CF-Connecting-IP`); provide a `key: (request) => string` function to customize. Limits are enforced per Cloudflare location (per-colo), which is sufficient for abuse prevention. See [Rate limiting](#rate-limiting) below.
- `resources`: map of React-Admin resources to table config

Each resource config:

- `tableName`, `idField`
- `selectableFields`, `filterableFields`, `sortableFields`, `searchableFields`
- `softDelete`: `{ field, type }` (optional)
- `transforms`: `{ booleans, dates, json }` (optional)

> **Primary-key handling:** `idField` is implicitly selectable, sortable, and
> filterable even if you omit it from those arrays. `POST` (create) accepts the
> primary key in the body, so tables with client-supplied keys (UUIDs, slugs)
> work out of the box; auto-increment tables simply omit it. `PUT`/bulk update
> never mutate the primary key (it is identified by the request path/ids).

## Client (`ra-cloudflare-d1`)

`createD1DataProvider({ apiUrl, apiKey, useBulkOperations, transforms })`

Transforms are configured per resource:

- `booleanFields[resource] = ['is_featured']`
- `dateFields[resource] = ['created_at']`
- `jsonFields[resource] = ['metadata']`

> **Note:** The worker applies `ResourceConfig.transforms` server-side and is the
> single source of truth. Client-side `transforms` in `D1ProviderOptions` are only
> needed when using a provider that bypasses the worker's transforms (e.g. a
> custom fetch). If both are configured, both layers run — the client transforms
> are applied after the server's, so keep them in sync to avoid double-processing.

## Bulk operations (`updateMany` / `deleteMany`)

The `POST /:resource/__bulkUpdate` and `POST /:resource/__bulkDelete` endpoints
accept `{ ids, data }` / `{ ids }` and process ids in chunks via D1 `batch`.

- **Zero matches** — if no rows are affected at all, the response is `404 NOT_FOUND`.
- **Partial matches** — when _some_ ids exist and others do not, the response
  echoes back **all requested ids** (including non-existent ones) with HTTP 200.
  D1's `batch` API returns a per-chunk `meta.changes` count but does not identify
  _which_ individual ids were affected, so the worker cannot filter the response
  to only the matched ids without an additional `SELECT`.
- **Non-atomic** — D1 `batch` is sequential but **not transactional**. If a later
  chunk fails, earlier chunks remain committed. The error response includes a
  message noting this.

If you need exact affected-id semantics, issue individual `PUT`/`DELETE` requests
per id (set `useBulkOperations: false` on the data provider) or follow up with a
`getList` filtered by the requested ids.

## Rate limiting

The worker supports optional rate limiting via Cloudflare's native [Rate Limiting
binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
It is available on all plans (including Free) and adds zero latency.

**1. Declare a binding in `wrangler.jsonc`:**

```jsonc
{
  "ratelimits": [
    {
      "name": "API_RATE_LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 100, "period": 60 }
    }
  ]
}
```

`period` must be `10` or `60` (seconds). The limit is enforced per Cloudflare
location (per-colo), which is ideal for abuse prevention.

**2. Pass the binding in your config:**

```ts
createD1RestApi({
  apiKey: env.API_KEY,
  corsOrigins: ["https://admin.example.com"],
  rateLimit: { binding: env.API_RATE_LIMITER },
  resources: { /* ... */ },
});
```

The default rate-limit key is the Bearer token from the `Authorization` header
(falls back to `CF-Connecting-IP`, then `"anonymous"`). To use a custom key:

```ts
rateLimit: {
  binding: env.API_RATE_LIMITER,
  key: (request) => request.headers.get("X-Tenant") ?? "default",
}
```

When the limit is exceeded the worker responds with `429 { error: { code: "RATE_LIMITED" } }`.
