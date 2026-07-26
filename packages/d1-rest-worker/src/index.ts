import type { RestWorkerConfig } from "rest-worker-types";
import type { D1RestApiOptions } from "./app.js";
import { createApp } from "./app.js";

export { ApiError } from "core-rest-worker";
export type { RestWorkerConfig, ResourceConfig } from "rest-worker-types";
export type { RestWorkerDb } from "core-rest-worker";
export { createD1Adapter } from "./adapter.js";
export type {
  D1Database,
  D1Result,
  D1Meta,
  D1PreparedStatement,
  EnvWithD1,
} from "./types.js";
export type { D1RestApiOptions } from "./app.js";

export function createD1RestApi(
  config: RestWorkerConfig,
  opts?: D1RestApiOptions,
) {
  const app = createApp(config, opts);
  return {
    fetch: app.fetch,
  };
}
