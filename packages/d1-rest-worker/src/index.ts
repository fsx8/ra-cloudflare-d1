import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { createApp } from "./app.js";
export { ApiError } from "./middleware/errors.js";

export type { D1RestConfig } from "@ra-cloudflare-d1/types";
export type { ResourceConfig } from "@ra-cloudflare-d1/types";

export function createD1RestApi(
  config: D1RestConfig,
  opts?: { dbBinding?: string },
) {
  const app = createApp(config, opts?.dbBinding ?? "DB");
  return {
    fetch: app.fetch,
  };
}
