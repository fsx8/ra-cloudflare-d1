import type { Context, Next } from "hono";
import { ApiError } from "./errors.js";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

export function authMiddleware(apiKey: string) {
  return async (c: Context, next: Next) => {
    if (c.req.method === "OPTIONS") {
      return next();
    }
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new ApiError("UNAUTHORIZED", "Missing bearer token");
    }
    const token = header.slice("Bearer ".length);
    if (!timingSafeEqual(token, apiKey)) {
      throw new ApiError("UNAUTHORIZED", "Invalid bearer token");
    }
    await next();
  };
}
