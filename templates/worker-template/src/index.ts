import { createD1RestApi } from "d1-rest-worker";

function parseCors(origins: unknown): string[] | "*" {
  if (!origins) return "*";
  if (origins === "*") return "*";
  if (typeof origins !== "string") return "*";
  const parts = origins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : "*";
}

function parseResources(raw: unknown) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    if (!env?.API_KEY) {
      return new Response(
        "Missing API_KEY. Set it via `wrangler secret put API_KEY`.",
        { status: 500 },
      );
    }
    const resources = parseResources(env.RESOURCE_CONFIG);
    if (!resources || typeof resources !== "object") {
      return new Response(
        "Missing/invalid RESOURCE_CONFIG. Provide a JSON object string in RESOURCE_CONFIG.",
        { status: 500 },
      );
    }
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: parseCors(env.CORS_ORIGINS),
      ...(env.API_RATE_LIMITER
        ? { rateLimit: { binding: env.API_RATE_LIMITER } }
        : {}),
      resources,
    }).fetch(request, env, ctx);
  },
};
