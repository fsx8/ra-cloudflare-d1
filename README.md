# ra-cloudflare-d1

[![CI](https://github.com/fsx8/ra-cloudflare-d1/actions/workflows/ci.yml/badge.svg)](https://github.com/fsx8/ra-cloudflare-d1/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ra-cloudflare-d1?label=ra-cloudflare-d1)](https://www.npmjs.com/package/ra-cloudflare-d1)
[![npm](https://img.shields.io/npm/v/d1-rest-worker?label=d1-rest-worker)](https://www.npmjs.com/package/d1-rest-worker)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A [React-Admin](https://marmelab.com/react-admin/) data provider backed by
[Cloudflare D1](https://developers.cloudflare.com/d1/), powered by a thin REST
Worker. Ship a full admin CRUD experience over your D1 database in minutes —
pagination, filtering, sorting, search, soft delete, bulk operations, and field
transforms, all behind a configurable allow-list.

It is a **Simple REST** dialect provider, so it drops in anywhere
`ra-data-simple-rest` would, but is purpose-built for D1.

## How it fits together

Two pieces work as a pair:

| Package                                                                        | What it is                                                                                       | Install                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------- |
| [`d1-rest-worker`](https://www.npmjs.com/package/d1-rest-worker)               | A Cloudflare Worker (Hono) exposing the REST API over your D1 database.                          | `pnpm add d1-rest-worker`   |
| [`ra-cloudflare-d1`](https://www.npmjs.com/package/ra-cloudflare-d1)           | The React-Admin data provider that talks to that Worker.                                         | `pnpm add ra-cloudflare-d1` |
| [`create-d1-rest-worker`](https://www.npmjs.com/package/create-d1-rest-worker) | An interactive CLI that scaffolds a ready-to-deploy Worker, with optional schema auto-discovery. | `npx create-d1-rest-worker` |
| `@ra-cloudflare-d1/types`                                                      | Shared TypeScript types consumed by the other packages.                                          | (internal)                  |

## Quick start

### 1. Scaffold and deploy the Worker

```bash
npx create-d1-rest-worker
cd d1-rest-worker
pnpm install
pnpm exec wrangler secret put API_KEY   # the Bearer token clients will use
pnpm run deploy
```

Add `--auto-discover` to have the CLI introspect your D1 database via the
Cloudflare API and generate per-table column/filter/sort/search configuration
automatically.

### 2. Install the data provider

```bash
pnpm add ra-cloudflare-d1
```

### 3. Wire it into React-Admin

```ts
import { createD1DataProvider } from "ra-cloudflare-d1";

export const dataProvider = createD1DataProvider({
  apiUrl: "https://YOUR_WORKER_URL/api",
  apiKey: "sk_...",
});
```

That's it — `getList`, `getOne`, `getMany`, `create`, `update`, `delete`, and
their `*Many`/bulk variants are all supported.

> **Security:** The `apiKey` is sent from the browser in the `Authorization:
Bearer` header. Any value embedded in client-side code is retrievable by
> visitors, so treat it as a **public** credential — it deters casual traffic and
> cross-origin abuse but is **not** a true secret. For a production admin, put
> the Worker behind a real authentication layer (Cloudflare Access, JWT
> validation, etc.). See [docs/quick-start.md](docs/quick-start.md).

## Features

- **Simple REST compatible** — drop-in for `ra-data-simple-rest`.
- **Allow-list security** — only operator-declared tables/columns are selectable,
  filterable, sortable, or searchable; all identifiers are validated and values
  are SQL-parameterized.
- **Pagination, filtering & sorting** — inclusive range pagination with a
  configurable `maxPerPage` cap; operator suffixes (`_gt`, `_gte`, `_lt`,
  `_lte`, `_contains`, `_startsWith`, `_endsWith`), `IN` arrays, and `q`
  full-text-ish search.
- **Soft delete** — timestamp or boolean soft-delete columns, excluded by default
  and includable via `?includeDeleted=true`.
- **Bulk operations** — `updateMany`/`deleteMany` chunked over D1 `batch`, with a
  permissive fallback to individual requests.
- **Field transforms** — server-side boolean/date/JSON coercion, optional to
  mirror on the client.
- **Schema endpoint** — `GET /__schema` introspects configured tables for tooling.
- **TypeScript-first** — strict, type-checked, with published `.d.ts` and maps.

## Manual Worker setup

Prefer to write the Worker yourself? It's one function call:

```ts
import { createD1RestApi } from "d1-rest-worker";

export default {
  async fetch(request, env, ctx) {
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: "*",
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
    }).fetch(request, env, ctx);
  },
};
```

The default D1 binding name is `"DB"`; override it with the second argument:
`createD1RestApi(config, { dbBinding: "MY_DB" })`.

## Documentation

- [Quick start](docs/quick-start.md)
- [Deployment options](docs/deployment-options.md) — CLI, template, or manual
- [Configuration reference](docs/configuration-reference.md) — worker & provider config, bulk-operation semantics
- [Filter operators](docs/filter-operators.md)
- [Soft delete](docs/soft-delete.md)
- [Migration guide](docs/migration-guide.md) — coming from `ra-data-simple-rest`

## Development

This is a pnpm + turbo monorepo (Node 20, TypeScript, Vitest). From the repo
root:

```bash
pnpm install
pnpm build        # tsc -p tsconfig.build.json per package
pnpm typecheck    # depends on ^build
pnpm test         # vitest run (integration test is opt-in via INTEGRATION=1)
pnpm lint         # ESLint (type-checked)
pnpm format       # prettier -w .
```

The integration test spins up `workerd` via `getPlatformProxy`; run it locally
with `INTEGRATION=1 pnpm --filter d1-rest-worker test`.

Releases are managed with [Changesets](https://github.com/changesets/changesets):
add a changeset (`pnpm changeset`), and merging the auto-generated "Version
Packages" PR publishes everything under `packages/**` to npm.

## License

[MIT](./LICENSE)
