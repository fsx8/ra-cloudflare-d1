# AGENTS.md

Repo-specific guidance for OpenCode sessions. Verify against current code before relying on it.

## Toolchain

- pnpm@11 workspaces + turbo monorepo, TypeScript 7, vitest, Node 24 (CI).
- Formatting: `pnpm format` (prettier -w .). Linting: `pnpm lint` (ESLint 10 + typescript-eslint `recommendedTypeChecked`, flat config at repo root).
- TypeScript is pinned to `~6.0.3`, not `^7.x`, because `typescript-eslint` peers `typescript: <6.1.0`. Don't bump TS past 6.0.x without checking that constraint.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (1 day): freshly-published deps will not install until 24h old. If a brand-new release is rejected, this is why. `allowBuilds` permits esbuild/sharp/workerd install scripts.

## Workspace layout

Four published packages under `packages/`; everything else is private. Package directory names do not match npm names — use the npm names when filtering.

| dir                              | npm name                  | role                                                    |
| -------------------------------- | ------------------------- | ------------------------------------------------------- |
| `packages/shared-types`          | `@ra-cloudflare-d1/types` | types-only, depended on by all others (no runtime code) |
| `packages/d1-rest-worker`        | `d1-rest-worker`          | Cloudflare Worker (Hono) exposing the REST API          |
| `packages/ra-cloudflare-d1`      | `ra-cloudflare-d1`        | react-admin data provider; peer-depends on `ra-core`    |
| `packages/create-d1-rest-worker` | `create-d1-rest-worker`   | CLI scaffolder (commander/handlebars/inquirer)          |

- `templates/worker-template` and `examples/{basic,advanced}-admin/{admin,worker}` are private workspace projects used by the CLI and for manual validation; not published.
- Public entrypoints: `createD1RestApi(config, opts?)` from `d1-rest-worker` (returns `{ fetch }`; default D1 binding name is `"DB"`, override via 2nd arg), and `createD1DataProvider({ apiUrl, apiKey })` from `ra-cloudflare-d1`.

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
