import type { Context, Next } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";

const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOW_HEADERS = "Authorization, Content-Type";
const EXPOSE_HEADERS = "Content-Range, X-Total-Count";

function resolveOrigin(
  requestOrigin: string | undefined,
  corsOrigins: RestWorkerConfig["corsOrigins"],
) {
  if (corsOrigins === "*") return "*";
  if (!requestOrigin) return corsOrigins[0] ?? "*";
  return corsOrigins.includes(requestOrigin) ? requestOrigin : "";
}

export function corsMiddleware(config: Pick<RestWorkerConfig, "corsOrigins">) {
  return async (c: Context, next: Next) => {
    const origin = resolveOrigin(c.req.header("Origin"), config.corsOrigins);

    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }
    c.header("Access-Control-Allow-Methods", ALLOW_METHODS);
    c.header("Access-Control-Allow-Headers", ALLOW_HEADERS);
    c.header("Access-Control-Expose-Headers", EXPOSE_HEADERS);

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  };
}
