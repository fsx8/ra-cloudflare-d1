import type { Client } from "@libsql/client/web";
import type { RestWorkerConfig } from "rest-worker-types";
import { createClient } from "@libsql/client/web";
import type { RestWorkerDb } from "core-rest-worker";
import { createRestApp } from "core-rest-worker";
import { createTursoAdapter } from "./adapter.js";

export { ApiError } from "core-rest-worker";
export type { RestWorkerConfig, ResourceConfig } from "rest-worker-types";
export type { RestWorkerDb } from "core-rest-worker";
export { createTursoAdapter } from "./adapter.js";

/**
 * How `createTursoRestApi` obtains its database adapter. Exactly one form:
 *
 * - `{ url, authToken }` — constructs a fresh libSQL HTTP client (default; the
 *   standalone quick-start path).
 * - `{ client }` — reuse a caller-owned `@libsql/client` `Client` (e.g. one
 *   already wrapped by Drizzle/Kysely in the host worker) to avoid opening a
 *   second connection pool to the same database.
 * - `{ adapter }` — lowest-level escape hatch: supply any `RestWorkerDb`. Use
 *   this to mount the REST worker over an in-memory or custom adapter, or to
 *   share a single adapter instance across sub-routes.
 */
export type TursoRestApiOptions =
  | { url: string; authToken: string }
  | { client: Client }
  | { adapter: RestWorkerDb };

export function createTursoRestApi(
  config: RestWorkerConfig,
  opts: TursoRestApiOptions,
) {
  const adapter: RestWorkerDb =
    "adapter" in opts
      ? opts.adapter
      : "client" in opts
        ? createTursoAdapter(opts.client)
        : createTursoAdapter(
            createClient({ url: opts.url, authToken: opts.authToken }),
          );
  const app = createRestApp(config, { adapter: () => adapter });
  return { fetch: app.fetch };
}
