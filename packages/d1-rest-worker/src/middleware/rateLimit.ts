import type { Context, Next } from "hono";
import type { ApiErrorResponse, RateLimitConfig } from "@ra-cloudflare-d1/types";

function defaultKey(c: Context): string {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  return c.req.header("CF-Connecting-IP") ?? "anonymous";
}

export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const key = config.key ? config.key(c.req.raw) : defaultKey(c);
    const { success } = await config.binding.limit({ key });
    if (!success) {
      const body: ApiErrorResponse = {
        error: { code: "RATE_LIMITED", message: "Rate limit exceeded" },
      };
      return c.json(body, 429);
    }
    await next();
  };
}
