# Refactor handoff: multi-database support (D1 + Turso) in `ra-cloudflare-d1`

> Status: **complete and fully green.** All phases 1–3 plus the previously
> deferred `create-turso-rest-worker` CLI are done. Nothing is committed yet;
> this document describes the working tree as it stands on `main` + uncommitted
> changes.

---

## 1. Background and the decision

### Where this came from

The maintainer maintains two related React-Admin efforts:

- **`fsx8/ra-cloudflare-d1`** — a mature, released monorepo (pnpm + turbo,
  Vitest, ESLint, Changesets) with a Cloudflare D1 REST Worker, a React-Admin
  data provider, and a scaffold CLI. Rich feature set: allow-list security,
  operator-suffix filtering, `q` search, soft delete, chunked bulk ops, field
  transforms, API-key auth, optional rate limiting, schema endpoint.
- **`fsx8/ra-turso`** — an abandoned single-file prototype (~400 lines, no tests
  / CI / changesets) that smashed a Turso/libSQL Hono backend and a fetch-based
  provider into one package. Security gaps in its generic SQL path, weak
  filtering, no auth/rate-limiting.

### The strategic question

Finish `ra-turso` by porting features over, **or** consolidate both into the
`ra-cloudflare-d1` repo?

### The decision: consolidate

The two are Simple-REST dialect providers over **edge SQLite-flavored
databases** on Workers. ~90% of the logic (filter operators, soft delete,
allow-list, bulk chunking, field transforms, CORS/auth/error middleware) is
database-agnostic. "Finishing" ra-turso would mean rebuilding what already
exists in the d1 repo — strictly more work than adapting the d1 repo to also
speak Turso.

Three naming/structure decisions were confirmed up front:

1. **Core package name:** `core-rest-worker` (flat, neutral).
2. **Rename the shared types package:** `@ra-cloudflare-d1/types` →
   `rest-worker-types`, and the config type `D1RestConfig` → `RestWorkerConfig`
   (it was never D1-specific). Early version, low breakage.
3. **Provider strategy:** **single source, dual publish.** `ra-turso` is a
   thin, Turso-branded re-export of `ra-cloudflare-d1`. The provider logic
   lives in exactly one place; Turso consumers see only Turso-branded names.

The guiding principle for the consumer surface: **shared invisible core,
separate branded products on top.** Each database's users install a
purpose-named worker + provider and never see the other database's name. The
fact that one engine powers both is implementation detail.

---

## 2. Target architecture (what now exists)

```
                         ┌──────────────────────┐
                         │  rest-worker-types    │  types only (config/query/response)
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  core-rest-worker     │  DB-agnostic engine + RestWorkerDb contract
                         │  (sql, middleware,    │  createRestApp(config, { adapter })
                         │   routes, app)        │
                         └──┬───────────────┬───┘
            ┌───────────────┘               └────────────────┐
   ┌────────▼─────────┐                                  ┌────▼──────────────┐
   │  d1-rest-worker   │  thin D1 adapter                │ turso-rest-worker │  thin libSQL adapter
   │  createD1RestApi  │                                 │ createTursoRestApi│
   └────────┬──────────┘                                 └────────┬──────────┘
            │                                                     │
            └──────────────┬──────────────────────┬───────────────┘
                     ┌────▼─────┐            ┌─────▼──────┐
                     │ ra-      │            │ ra-turso    │  re-export of ra-cloudflare-d1
                     │ cloudflare│           │ createTurso │  (createTursoDataProvider)
                     │ -d1      │            │ DataProvider│
                     └──────────┘            └─────────────┘
                  createD1DataProvider     (source of truth)
```

### Package map

| dir                                 | npm name                   | role                                                                                                      |
| ----------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/shared-types`             | `rest-worker-types`        | types-only (config/query/response). **Renamed** from `@ra-cloudflare-d1/types`.                           |
| `packages/core-rest-worker`         | `core-rest-worker`         | **NEW.** DB-agnostic engine + the `RestWorkerDb` adapter contract + `createRestApp(config, { adapter })`. |
| `packages/d1-rest-worker`           | `d1-rest-worker`           | Now a ~20-line D1 adapter over core. Public `createD1RestApi(config, opts?)` API unchanged.               |
| `packages/turso-rest-worker`        | `turso-rest-worker`        | **NEW.** libSQL adapter (`@libsql/client/web`) + `createTursoRestApi(config, { url, authToken })`.        |
| `packages/ra-cloudflare-d1`         | `ra-cloudflare-d1`         | Provider — **source of truth.** Public API unchanged.                                                     |
| `packages/ra-turso`                 | `ra-turso`                 | **NEW.** Turso-branded aliased re-export of `ra-cloudflare-d1`.                                           |
| `packages/create-d1-rest-worker`    | `create-d1-rest-worker`    | CLI — only an import rename.                                                                              |
| `packages/create-turso-rest-worker` | `create-turso-rest-worker` | **NEW.** Turso CLI scaffolder; auto-discovers schema by querying Turso over libSQL.                       |

### The adapter contract (the heart of the refactor)

`packages/core-rest-worker/src/db.ts`:

```ts
export type DbRow = Record<string, unknown>;

export interface ExecResult {
  rows: DbRow[];
  changes: number;
}

export interface DbStatement {
  sql: string;
  params: unknown[];
}

export interface RestWorkerDb {
  execute(sql: string, params: unknown[]): Promise<ExecResult>;
  executeMany(statements: DbStatement[]): Promise<ExecResult[]>;
}

export type RestAppEnv = { Variables: { db: RestWorkerDb } };
```

Two methods — that's the entire seam. Everything in `core-rest-worker/src/sql`,
`/middleware`, and `/routes` is pure over `(config, request)`; the only
database awareness is `c.get("db")` in each route.

The adapter is resolved **per request** from `env` in `createRestApp` and stored
in a Hono context variable:

```ts
app.use("*", async (c, next) => {
  c.set("db", opts.adapter(c.env));
  await next();
});
```

- **D1** needs the binding from `env`, so its adapter factory is
  `(env) => createD1Adapter(getD1Database(env, binding))`.
- **Turso** closes over a client created once at factory time, so its factory
  ignores `env`: `() => createTursoAdapter(client)`.

To add a third backend (Neon, Supabase, local SQLite, …) you implement
`RestWorkerDb` (~20 lines) and call `createRestApp(config, { adapter })`. The
two existing adapters are the reference.

---

## 3. What changed (summary)

### Moved core-rest-worker (NEW)

- `src/db.ts` — adapter contract + `RestAppEnv`.
- `src/app.ts` — `createRestApp(config, { adapter })`; mounts routes without any `dbBinding`.
- `src/sql/{builder,chunker,validator}.ts` — moved verbatim (only the types import path + `D1RestConfig`→`RestWorkerConfig`).
- `src/middleware/{auth,cors,errors,rateLimit}.ts` — moved verbatim.
- `src/routes/*.ts` — moved and **refactored**: signature `(c, config, dbBinding)` + `getD1Database(...)` → `(c, config)` + `c.get("db")`; D1-shaped calls (`prepare().bind().all()`, `batch()`, `res.results`, `res.meta.changes`) → adapter calls (`execute`, `executeMany`, `res.rows`, `res.changes`).
- `src/index.ts` — exports `createRestApp`, `ApiError`, adapter types, re-exports config types.
- `test/{builder,chunker,middleware}.test.ts` — moved from d1 (pure-function tests).

### Rewired d1-rest-worker (thin adapter)

- `src/adapter.ts` (NEW) — `createD1Adapter(d1)` wraps a `D1Database`, normalizing `{ results, meta.changes }` → `{ rows, changes }`.
- `src/app.ts` — reduced to a 4-line **`createApp(config, dbBinding="DB")` shim** that wraps `createRestApp` with the D1 adapter. Kept so `test/routes.test.ts` is unchanged.
- `src/index.ts` — `createD1RestApi(config, opts?)` wraps `createApp`. Re-exports `ApiError` from core and `RestWorkerConfig`/`ResourceConfig` from `rest-worker-types`.
- `src/types.ts` — **unchanged** (D1 type defs + `getD1Database`).
- `src/{sql,middleware,routes}/` — **deleted** (moved to core).
- `test/{builder,chunker,middleware}.test.ts` — **deleted** (moved to core).
- `test/routes.test.ts` — **unchanged** except the type rename import.

### NEW turso-rest-worker

- `src/adapter.ts` — `createTursoAdapter(client)` wraps `@libsql/client`. Maps rows via `res.columns` into clean column-keyed objects (libSQL `Row` is array-like with both numeric and name indices), maps `rowsAffected` → `changes`.
- `src/index.ts` — `createTursoRestApi(config, { url, authToken })`; creates the client once and closes over it.
- `test/adapter.test.ts` — 4 tests with a fake `Client` (row mapping, `rowsAffected`→`changes`, param forwarding, drops array-like artifacts).

### NEW ra-turso

- `src/index.ts` — selective **aliased** re-export: `createD1DataProvider as createTursoDataProvider`, plus `TursoProviderOptions`/`TursoDataProvider`. Turso users never see a D1 name.

### Renames across the repo

- Package `@ra-cloudflare-d1/types` → `rest-worker-types` (package.json name + every importer).
- Type `D1RestConfig` → `RestWorkerConfig` (definition + all usages).
- Updated importers: `ra-cloudflare-d1/src/httpClient.ts`, all `create-d1-rest-worker` source + test, `d1-rest-worker` source/tests.

### Config / docs

- `eslint.config.mjs` — added the 3 new packages' tsconfigs to the type-checked `project` list (otherwise ESLint can't match their files).
- `AGENTS.md` — rewrote the workspace-layout section (package table, adapter contract notes).
- `README.md` — dual-database intro, expanded package table, Turso quick-start, generalized the bulk-ops feature bullet.
- Per-package READMEs for the 3 new packages.
- `.changeset/multi-db-turso.md` — release plan (see [Publishing](#publishingrelease)).

---

## 4. How it was verified

A deliberate choice kept the biggest test file untouched, which is the strongest
behavioral guarantee:

> `d1-rest-worker`'s **733-line `test/routes.test.ts` was left byte-for-byte
> unchanged.** It still calls `createApp(config)` and injects `{ DB: fakeDb }`.
> That fake D1 now flows through the **real D1 adapter** (`createD1Adapter`)
> into core's routes — so all 31 route tests exercise the exact same SQL/param
> behavior as before, proving the extraction preserved semantics.

Final verification (all green):

| Step             | Result                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`     | 10/10 packages                                                                                                                     |
| `pnpm typecheck` | 12/12                                                                                                                              |
| `pnpm test`      | 12/12 — core 33, d1 31 (+1 integration skipped), ra-cloudflare-d1 30, turso 4, create-d1-rest-worker 4, create-turso-rest-worker 5 |
| `pnpm lint`      | 8/8 (ESLint `recommendedTypeChecked`)                                                                                              |

Footprint: **59 files changed, +1135 / −327.**

Note: turbo emits `[WARN] Failed to replace env in config: ${NPM_TOKEN}` for
several packages. This is **pre-existing** (turbo trying to interpolate an env
var in each package's `.npmrc`/publish config) and unrelated to this work.

---

## 5. Review instructions

Read in this order — it goes from the smallest/most-important outward.

### 5.1 The contract (read first)

- **`packages/core-rest-worker/src/db.ts`** — the entire adapter contract. ~20 lines. This is the design crux; everything else follows from it.

### 5.2 How the adapter is wired

- **`packages/core-rest-worker/src/app.ts`** — `createRestApp`. Note the `app.use("*", …)` that resolves the adapter from `c.env` per request and sets the Hono `db` variable, and that routes are mounted on an inner `api` Hono at `basePath`.
- **`packages/d1-rest-worker/src/adapter.ts`** — reference adapter. Confirms `{ results, meta.changes }` → `{ rows, changes }`.
- **`packages/d1-rest-worker/src/app.ts`** — the 4-line `createApp` shim. This is what keeps `routes.test.ts` unchanged.
- **`packages/turso-rest-worker/src/adapter.ts`** — second adapter; shows the pattern repeats cleanly and shows the libSQL row-mapping via `columns`.

### 5.3 A representative refactored route

- **`packages/core-rest-worker/src/routes/list.ts`** — uses `executeMany` for the SELECT + COUNT pair; sets `Content-Range`/`X-Total-Count`.
- Skim the other routes (`one`, `create`, `update`, `delete`, `bulkUpdate`, `bulkDelete`, `schema`) — they all follow the identical `c.get("db")` + `execute`/`executeMany` pattern. The moved-as-is files (`sql/builder.ts`, `sql/chunker.ts`, `sql/validator.ts`, `middleware/*`, `routes/query.ts`, `routes/transforms.ts`) should be diffed to confirm **only** the import path/type name changed.

### 5.4 The provider re-export

- **`packages/ra-turso/src/index.ts`** — confirm only Turso-branded names are exported (no `export *` leaking D1 symbols).

### 5.5 Proof of behavior preservation

- **`packages/d1-rest-worker/test/routes.test.ts`** — `git diff` should show **only** the import line and the two `Partial<D1RestConfig>` → `Partial<RestWorkerConfig>` annotations (plus the `replaceAll` of `Partial<D1RestConfig>` in the `setup` helpers). If the diff is larger, something regressed.

### 5.6 Release metadata + docs

- **`.changeset/multi-db-turso.md`** — confirm the per-package bumps match your intent (see below).
- **`AGENTS.md`** workspace-layout section and **`README.md`** — sanity-check the narrative.

### 5.7 Re-verify locally

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test && pnpm lint
# Optional: the D1 workerd integration test (spins up Miniflare)
INTEGRATION=1 pnpm --filter d1-rest-worker test
```

---

## 6. Decisions and caveats to be aware of

1. **Bulk-op error messages were generalized.** Core's `bulkUpdate`/`bulkDelete`
   previously said "…(D1 batch is not transactional)". That's true for D1 but
   **false for libSQL** (its `batch` runs in a transaction and rolls back on
   failure). Since core is shared, the message is now just `"Bulk update failed."`
   / `"Bulk delete failed."`. If you want DB-specific messaging, the adapter
   would need to surface transactionality — out of scope for now. Worth a line
   in each worker's README.

2. **libSQL integer handling.** `@libsql/client` defaults to
   `intMode: "number"`, so integers come back as JS numbers (matching D1). If a
   user configures `intMode: "bigint"` or `"string"`, values would be bigints/
   strings — the Turso adapter does **not** coerce. BLOB columns arrive as
   `ArrayBuffer`/`Uint8Array`, which `JSON.stringify` cannot serialize. BLOB
   support in the REST response is a known gap for the Turso path; document it
   or add normalization in `createTursoAdapter` if needed.

3. **`ra-turso` is a pure re-export.** No runtime code of its own. A bug fix in
   the provider lands once (in `ra-cloudflare-d1`) and ships in both. The cost:
   the two packages are version-locked to the same provider code, which is the
   intent. The changeset's `updateInternalDependencies: patch` will keep
   `ra-turso`'s dep on `ra-cloudflare-d1` in sync on each release.

4. **Per-request adapter resolution.** The adapter factory runs on every
   request. The D1 lookup (`getD1Database`) is trivial; the Turso client is
   created **once** at factory time and closed over, so only the cheap
   `() => createTursoAdapter(client)` closure runs per request. No perf concern.

5. **The `createApp` shim in d1 is kept for tests.** It's slightly redundant
   with `createD1RestApi` (both build the same app). It exists so the legacy
   test file didn't need rewriting. If you ever rewrite `routes.test.ts` to use
   `createD1RestApi` directly (or to use a fake adapter in core), the shim can
   go.

---

## 7. Publishing / release

The changeset is at `.changeset/multi-db-turso.md`. Proposed bumps:

| Package                 | Bump  | Why                                                                                |
| ----------------------- | ----- | ---------------------------------------------------------------------------------- |
| `core-rest-worker`      | minor | new package (0.1.0 first release)                                                  |
| `turso-rest-worker`     | minor | new package (0.1.0 first release)                                                  |
| `ra-turso`              | minor | new package (0.1.0 first release)                                                  |
| `rest-worker-types`     | major | rename of `@ra-cloudflare-d1/types` + `D1RestConfig`→`RestWorkerConfig` (breaking) |
| `d1-rest-worker`        | major | re-exports `RestWorkerConfig` instead of `D1RestConfig` (breaking type import)     |
| `ra-cloudflare-d1`      | patch | internal dep rename only; public API unchanged                                     |
| `create-d1-rest-worker` | patch | internal dep rename only                                                           |

**Review the bump levels before merging the Version PR** — they're a judgment
call. Flow:

1. `pnpm changeset` to adjust if needed (or edit the file directly).
2. Push to `main` → the `release.yml` workflow opens a "Version Packages" PR.
3. Merging that PR publishes everything under `packages/**` to npm.
4. **Manually deprecate the orphaned package:**
   `npm deprecate @ra-cloudflare-d1/types@0.3.0 "Renamed to rest-worker-types. See https://github.com/fsx8/ra-cloudflare-d1"`

Because `rest-worker-types`, `core-rest-worker`, `turso-rest-worker`, and
`ra-turso` have never been published, confirm the Version PR picks them up as
new packages and publishes them at their current `version` fields.

---

## 8. `create-turso-rest-worker` CLI (previously deferred — now done)

The Turso counterpart to `create-d1-rest-worker`, implemented by cloning the D1
CLI and swapping the D1-specific bits. `npx create-turso-rest-worker`.

### What it does

- **Prompts** for Turso credentials (`TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`)
  instead of a D1 binding/database ID. The token is prompted always — unlike the
  D1 CLI's Cloudflare API token, the Turso token is a runtime secret the worker
  needs regardless of discovery, so it lands in `.dev.vars` either way.
- **Schema auto-discovery over libSQL.** Turso has no hosted schema API
  equivalent to Cloudflare's D1 REST API, so `turso-schema.ts` connects with
  `@libsql/client` (node entry — the CLI runs in Node, not on Workers) and runs
  the same `SELECT … FROM sqlite_master` + `PRAGMA table_info` queries the core
  `schemaRoute` and the D1 discovery both use. The pure inference helpers
  (`inferTransforms`, `inferSoftDelete`, `validateIdentifier`) are duplicated
  verbatim from the D1 `schema-discovery.ts` — these are ~50 lines of pure
  functions; sharing would require a new internal package or cross-CLI dep,
  which isn't worth the coupling for two independently-installed scaffolders.
- **Templates** mirror the D1 CLI's 7 handlebars files, swapping:
  `createD1RestApi` → `createTursoRestApi`, the `d1_databases` wrangler block →
  a `vars` block carrying `TURSO_CONNECTION_URL` (non-secret), and the D1
  binding/databaseId generator inputs → `tursoUrl`/`tursoAuthToken`. Secrets
  (`API_KEY`, `TURSO_AUTH_TOKEN`) go only into `.dev.vars`; the Turso URL goes
  into `wrangler.jsonc` `vars` (mirroring how `database_id` lives in wrangler).
- **Lint note:** libSQL's `Row` values are typed `Value` (includes
  `Uint8Array`/`ArrayBuffer`), so reading PRAGMA columns triggers
  `@typescript-eslint/no-base-to-string` on bare `String(r.name)`. The discovery
  uses `typeof` guards instead — also more correct, since PRAGMA columns are
  always text/integer. The D1 CLI sidesteps this via a generic cast on its
  `queryD1<T>` helper, which the libSQL path doesn't have.

### Test coverage

`test/generator.test.ts` mirrors the D1 CLI's generator tests (5 tests): no
`.hbs` in output, valid `package.json` (depends on `turso-rest-worker`),
unescaped resources object in `src/index.ts`, Turso URL in `wrangler.jsonc` /
token in `.dev.vars` (and a guard that the secret token never leaks into
`wrangler.jsonc`), and all template files rendered without `.hbs` suffix.

---

## 9. Quick command reference

```bash
# Full verification loop (run from repo root after any change)
pnpm install
pnpm build && pnpm typecheck && pnpm test && pnpm lint

# Scope a command to one package
pnpm --filter core-rest-worker test
pnpm --filter turso-rest-worker build

# D1 workerd integration test (opt-in)
INTEGRATION=1 pnpm --filter d1-rest-worker test

# Format (prettier) — repo convention is to format the whole tree
pnpm format

# Add/adjust a changeset before release
pnpm changeset
```

### Key file map (for jumping around)

- Adapter contract: `packages/core-rest-worker/src/db.ts`
- App factory: `packages/core-rest-worker/src/app.ts`
- D1 adapter: `packages/d1-rest-worker/src/adapter.ts`
- D1 test shim: `packages/d1-rest-worker/src/app.ts`
- Turso adapter: `packages/turso-rest-worker/src/adapter.ts`
- Provider source of truth: `packages/ra-cloudflare-d1/src/dataProvider.ts`
- Provider re-export: `packages/ra-turso/src/index.ts`
- Release plan: `.changeset/multi-db-turso.md`
- Maintainer notes: `AGENTS.md`
