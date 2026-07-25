import type { RestWorkerConfig } from "rest-worker-types";
import { createApp } from "./app.js";

export { ApiError } from "core-rest-worker";
export type { RestWorkerConfig, ResourceConfig } from "rest-worker-types";

export function createD1RestApi(
  config: RestWorkerConfig,
  opts?: { dbBinding?: string },
) {
  const app = createApp(config, opts?.dbBinding ?? "DB");
  return {
    fetch: app.fetch,
  };
}
