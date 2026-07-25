# AGENTS.md

Repo-specific guidance for OpenCode sessions. Verify against current code before relying on it.

## Toolchain

- pnpm@11 workspaces + turbo monorepo, TypeScript 7, vitest, Node 24 (CI).
- Formatting: `pnpm format` (prettier -w .). Linting: `pnpm lint` (ESLint 10 + typescript-eslint `recommendedTypeChecked`, flat config at repo root).
- TypeScript is pinned to `~6.0.3`, not `^7.x`, because `typescript-eslint` peers `typescript: <6.1.0`. Don't bump TS past 6.0.x without checking that constraint.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (1 day): freshly-published deps will not install until 24h old. If a brand-new release is rejected, this is why. `allowBuilds` permits esbuild/sharp/workerd install scripts.

## Workspace layout

Seven published packages under `packages/`; everything else is private. Package directory names do not match npm names — use the npm names when filtering.

The REST dialect, SQL building, and HTTP layer are database-agnostic and live in `core-rest-worker`. Each database backend is a thin adapter over the core (`RestWorkerDb` interface in `core-rest-worker/src/db.ts`). Both backends speak the same Simple-REST dialect, so there is a single provider implementation (`ra-cloudflare-d1`) which `ra-turso` re-exports under Turso-branded names.

| dir                                 | npm name                   | role                                                                                                                               |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared-types`             | `rest-worker-types`        | types-only (config/query/response), depended on by all others (no runtime code)                                                    |
| `packages/core-rest-worker`         | `core-rest-worker`         | DB-agnostic engine: SQL builder, middleware, routes, `createRestApp(config, { adapter })`, and the `RestWorkerDb` adapter contract |
| `packages/d1-rest-worker`           | `d1-rest-worker`           | thin D1 adapter + `createD1RestApi(config, opts?)` wrapping core (default binding `"DB"`)                                          |
| `packages/turso-rest-worker`        | `turso-rest-worker`        | thin libSQL/Turso adapter + `createTursoRestApi(config, { url, authToken })` wrapping core                                         |
| `packages/ra-cloudflare-d1`         | `ra-cloudflare-d1`         | react-admin data provider (source of truth); peer-depends on `ra-core`                                                             |
| `packages/ra-turso`                 | `ra-turso`                 | react-admin data provider; aliased re-export of `ra-cloudflare-d1` (`createTursoDataProvider`)                                     |
| `packages/create-d1-rest-worker`    | `create-d1-rest-worker`    | CLI scaffolder (commander/handlebars/inquirer). Auto-discovers schema via the Cloudflare D1 API.                                   |
| `packages/create-turso-rest-worker` | `create-turso-rest-worker` | CLI scaffolder (commander/handlebars/inquirer). Auto-discovers schema by querying Turso directly over libSQL.                      |

- `templates/worker-template` and `examples/{basic,advanced}-admin/{admin,worker}` are private workspace projects used by the CLI and for manual validation; not published.
- Public entrypoints: `createD1RestApi(config, opts?)` and `createTursoRestApi(config, opts)` from their worker packages (both return `{ fetch }`); `createD1DataProvider({ apiUrl, apiKey })` from `ra-cloudflare-d1` / `createTursoDataProvider(...)` from `ra-turso`.
- The core adapter contract: `RestWorkerDb { execute(sql, params): Promise<ExecResult>; executeMany(stmts): Promise<ExecResult[]> }` where `ExecResult = { rows: Record<string, unknown>[]; changes: number }`. To add a backend, implement this interface and call `createRestApp(config, { adapter })` — see `packages/d1-rest-worker/src/adapter.ts` and `packages/turso-rest-worker/src/adapter.ts` as references.

## Commands

Run from repo root unless noted. Each package has `build`, `typecheck`, `test`, `lint`. Scope to one package with `pnpm --filter <npm-name> <script>` (e.g. `pnpm --filter d1-rest-worker test`).

- `pnpm build` — turbo `build`, runs `tsc -p tsconfig.build.json` per package, emits to `dist/` with `.d.ts` + declaration maps.
- `pnpm typecheck` — turbo `typecheck`. **Depends on `^build`** (see turbo.json): downstream packages resolve `workspace:*` deps from built `dist/`, so always build first after touching `shared-types` or any cross-package change. Per-package typecheck tsconfig includes `test/**/*.ts`.
- `pnpm test` — turbo `test`. Vitest `run` (no watch).
- `pnpm format` — prettier write.
- `pnpm changeset` — add a changeset entry (see Releases).

Typical verification loop after a change: `pnpm build && pnpm typecheck && pnpm test && pnpm lint`. CI (`.github/workflows/ci.yml`) runs exactly `pnpm typecheck && pnpm lint && pnpm test` (with `INTEGRATION=1`).

## Integration test gotcha

`packages/d1-rest-worker/test/integration.platform-proxy.test.ts` is **opt-in**: it only runs when `INTEGRATION=1` is set, otherwise it's `describe.skip`'d. It spins up `workerd` via wrangler `getPlatformProxy` against `packages/d1-rest-worker/wrangler.jsonc`. Plain `pnpm test` skips it for speed; CI sets the env var.

To run it locally: `INTEGRATION=1 pnpm --filter d1-rest-worker test`.

## Releases

Changesets flow, base branch `main` (`.changeset/config.json`):

1. `pnpm changeset` to add an entry describing the bump per package.
2. Push to `main` → `.github/workflows/release.yml` runs `changesets/action`, which opens a "Version Packages" PR.
3. Merging that PR publishes everything under `packages/**` to npm via `pnpm -r --filter ./packages/** publish`. `prepublishOnly` rebuilds each package.

Note `updateInternalDependencies: patch` — any change to `@ra-cloudflare-d1/types` triggers patch bumps in the three dependents. Templates and examples are intentionally excluded from publish.

## Conventions

- `verbatimModuleSyntax` is on (tsconfig.base.json): always use `import type` for type-only imports.
- Each package keeps separate `tsconfig.build.json` (emits dist) and `tsconfig.typecheck.json` (noEmit, includes tests). Don't merge them.
- Worker code targets the Workers runtime; types come from `@cloudflare/workers-types`. The D1 binding is accessed as `env.DB` by default. Use `getD1Database(env, binding)` from `packages/d1-rest-worker/src/types.ts` (it does the runtime lookup + type narrowing); don't write `(c.env as any)[binding]` casts.
- The ESLint preset is `recommendedTypeChecked` (type-checked). It uses `parserOptions.project` pointing at each package's `tsconfig.typecheck.json` (or `tsconfig.build.json` for shared-types) — see `eslint.config.mjs`. Type-checked rules catch real bugs in the Worker route handlers (`no-floating-promises`, `no-misused-promises`) and enforce `no-unsafe-*` narrowing at JSON boundaries.
- `no-explicit-any` and the `no-unsafe-*` family are on. Prefer `unknown` + runtime narrowing over `as any`. Where a library hands you `any` (e.g. `res.json()`, ra-core's `RaRecord = any` generics), annotate the binding `: unknown` rather than casting — `as unknown` from `any` trips `no-unnecessary-type-assertion`.
