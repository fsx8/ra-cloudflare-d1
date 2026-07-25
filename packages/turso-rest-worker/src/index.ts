import type { RestWorkerConfig } from "rest-worker-types";
import { createClient } from "@libsql/client/web";
import { createRestApp } from "core-rest-worker";
import { createTursoAdapter } from "./adapter.js";

export { ApiError } from "core-rest-worker";
export type { RestWorkerConfig, ResourceConfig } from "rest-worker-types";

export interface TursoRestApiOptions {
  url: string;
  authToken: string;
}

export function createTursoRestApi(
  config: RestWorkerConfig,
  opts: TursoRestApiOptions,
) {
  const client = createClient({ url: opts.url, authToken: opts.authToken });
  const app = createRestApp(config, {
    adapter: () => createTursoAdapter(client),
  });
  return { fetch: app.fetch };
}
