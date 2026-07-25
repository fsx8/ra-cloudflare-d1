import type { RestWorkerConfig } from "rest-worker-types";
import { createRestApp } from "core-rest-worker";
import { createD1Adapter } from "./adapter.js";
import { getD1Database } from "./types.js";

export function createApp(config: RestWorkerConfig, dbBinding = "DB") {
  return createRestApp(config, {
    adapter: (env) => createD1Adapter(getD1Database(env, dbBinding)),
  });
}
