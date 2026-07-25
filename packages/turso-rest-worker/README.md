# turso-rest-worker

A Cloudflare Worker (Hono) that exposes a Simple-REST CRUD API over a [Turso](https://turso.tech) (libSQL) database, purpose-built for [React-Admin](https://marmelab.com/react-admin/). It is the Turso counterpart to [`d1-rest-worker`](https://www.npmjs.com/package/d1-rest-worker) and shares the exact same REST dialect, so the [`ra-turso`](https://www.npmjs.com/package/ra-turso) / [`ra-cloudflare-d1`](https://www.npmjs.com/package/ra-cloudflare-d1) data provider works with either.

Powered by the shared [`core-rest-worker`](https://www.npmjs.com/package/core-rest-worker) engine: pagination, operator-suffix filtering (`_gt`, `_contains`, …), `q` search, soft delete, chunked bulk operations, field transforms, API-key auth, optional rate limiting, and an allow-list that validates every identifier.

## Install

```bash
pnpm add turso-rest-worker hono @libsql/client
```

## Usage

```ts
import { createTursoRestApi } from "turso-rest-worker";

export default {
  async fetch(request, env) {
    return createTursoRestApi(
      {
        apiKey: env.API_KEY,
        corsOrigins: ["https://admin.example.com"],
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title", "body"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title", "body"],
          },
        },
      },
      { url: env.TURSO_CONNECTION_URL, authToken: env.TURSO_AUTH_TOKEN },
    ).fetch(request);
  },
};
```

Then on the client:

```ts
import { createTursoDataProvider } from "ra-turso";

const dataProvider = createTursoDataProvider({
  apiUrl: "https://YOUR_WORKER_URL/api",
  apiKey: "sk_...",
});
```

> **Security:** `apiKey` is sent from the browser and is retrievable by visitors — treat it as public. Restrict `corsOrigins` to your admin origin, and for production put the Worker behind Cloudflare Access or JWT validation.

## Limitations

- **Integer mode:** the adapter uses the libSQL client default `intMode: "number"`, so integers arrive as JS numbers (matching D1). If you configure `bigint` / `string` modes, values are **not** coerced by the adapter.
- **BLOB columns** arrive as `ArrayBuffer` / `Uint8Array`, which `JSON.stringify` cannot serialize. The REST path does not normalize BLOBs today — avoid exposing BLOB columns, or pre-serialize them. (The D1 backend is unaffected.)
- **Bulk operations** (`updateMany` / `deleteMany`) run in a single libSQL `batch`, which **is transactional** and rolls back on failure — unlike D1 batches, which are not transactional. The worker falls back to per-statement requests if the batch fails.

## License

MIT
