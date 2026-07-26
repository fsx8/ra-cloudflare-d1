# core-rest-worker

The database-agnostic engine behind the [`d1-rest-worker`](https://www.npmjs.com/package/d1-rest-worker) and [`turso-rest-worker`](https://www.npmjs.com/package/turso-rest-worker) packages — the Simple-REST CRUD dialect (pagination, filtering, sorting, soft delete, bulk operations, field transforms, allow-list security) for [React-Admin](https://marmelab.com/react-admin/), factored into a reusable core.

You normally don't depend on this directly; you use one of the backend packages. **But if you want to support another SQLite-flavored database** (Neon Postgres, Supabase, local SQLite, etc.), implement the small `RestWorkerDb` adapter contract and pass it to `createRestApp`.

## The adapter contract

```ts
import { createRestApp, type RestWorkerDb } from "core-rest-worker";

// Your adapter maps your driver's result shape to { rows, changes }.
export interface MyAdapter extends RestWorkerDb {
  execute(
    sql: string,
    params: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; changes: number }>;
  executeMany(
    stmts: { sql: string; params: unknown[] }[],
  ): Promise<{ rows: Record<string, unknown>[]; changes: number }[]>;
}

const app = createRestApp(config, { adapter: (env) => myAdapter });
```

See `packages/d1-rest-worker/src/adapter.ts` and `packages/turso-rest-worker/src/adapter.ts` in the [repo](https://github.com/fsx8/ra-edge-sqlite) for reference implementations (~20 lines each).

## Configuration

`createRestApp(config, { adapter })` takes a `RestWorkerConfig`. Two fields control authentication:

- **`apiKey`** — the bearer token checked against each request's `Authorization` header. Required by default.
- **`requireApiKey`** — defaults to `true` (bearer auth enforced). Set to `false` to skip application-level auth entirely. The auth middleware is not mounted, and `apiKey` is ignored.

```ts
const app = createRestApp(
  { requireApiKey: false, corsOrigins: "*", resources: { ... } },
  { adapter: (env) => myAdapter },
);
```

> **Security:** `requireApiKey: false` is only safe when the worker is fronted by a trusted authenticating proxy (Cloudflare Access, an API gateway, a service mesh, etc.) that gates every request before it reaches the worker. Without such a proxy, anyone can read and mutate your data.

## License

MIT
