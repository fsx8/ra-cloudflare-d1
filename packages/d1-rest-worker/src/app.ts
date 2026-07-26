import type { RestWorkerConfig } from "rest-worker-types";
import { createRestApp } from "core-rest-worker";
import type { RestWorkerDb } from "core-rest-worker";
import { createD1Adapter } from "./adapter.js";
import { getD1Database } from "./types.js";

/**
 * How `createD1RestApi` obtains its database adapter. Exactly one form:
 *
 * - `{ dbBinding?: string }` — resolve a D1 binding from the request `env` by
 *   name (default `"DB"`). The standard path for a standalone D1 Worker.
 * - `{ adapter: RestWorkerDb }` — supply a pre-built adapter instead of
 *   resolving one from `env`. Useful for tests (in-memory adapter) and for
 *   hosts that already hold a `D1Database` reference and want to mount the
 *   REST worker without a binding lookup.
 */
export type D1RestApiOptions =
  { dbBinding?: string } | { adapter: RestWorkerDb };

export function createApp(config: RestWorkerConfig, opts?: D1RestApiOptions) {
  const factory: (env: unknown) => RestWorkerDb =
    opts && "adapter" in opts
      ? () => opts.adapter
      : (env) => createD1Adapter(getD1Database(env, opts?.dbBinding ?? "DB"));
  return createRestApp(config, { adapter: factory });
}
