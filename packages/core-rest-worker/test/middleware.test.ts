import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { RateLimitBinding } from "rest-worker-types";
import { authMiddleware } from "../src/middleware/auth";
import { corsMiddleware } from "../src/middleware/cors";
import { rateLimitMiddleware } from "../src/middleware/rateLimit";
import { ApiError, handleError } from "../src/middleware/errors";

async function parseJson(res: Response): Promise<unknown> {
  return res.json();
}

function authApp(apiKey: string) {
  const app = new Hono();
  app.onError((err, c) => handleError(err, c));
  app.use("*", authMiddleware(apiKey));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

function corsApp(corsOrigins: string[] | "*") {
  const app = new Hono();
  app.use("*", corsMiddleware({ corsOrigins }));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

function mockRateLimit(success: boolean, keys?: string[]): RateLimitBinding {
  return {
    limit({ key }) {
      keys?.push(key);
      return Promise.resolve({ success });
    },
  };
}

function rateLimitApp(
  binding: RateLimitBinding,
  keyFn?: (req: Request) => string,
) {
  const app = new Hono();
  app.use("*", rateLimitMiddleware({ binding, key: keyFn }));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

function errorsApp() {
  const app = new Hono();
  app.onError((err, c) => handleError(err, c));
  app.get("/api-error", () => {
    throw new ApiError("NOT_FOUND", "not here", { id: 5 });
  });
  app.get("/validation-error", () => {
    throw new ApiError("VALIDATION_ERROR", "bad input");
  });
  app.get("/unique-constraint", () => {
    throw new Error("UNIQUE constraint failed: posts.title");
  });
  app.get("/not-null-constraint", () => {
    throw new Error("NOT NULL constraint failed: posts.title");
  });
  app.get("/foreign-key-constraint", () => {
    throw new Error("FOREIGN KEY constraint failed");
  });
  app.get("/check-constraint", () => {
    throw new Error("CHECK constraint failed: posts");
  });
  app.get("/primary-key-constraint", () => {
    throw new Error("PRIMARY KEY constraint failed: posts.id");
  });
  app.get("/generic-error", () => {
    throw new Error("something went wrong");
  });
  return app;
}

describe("middleware", () => {
  describe("authMiddleware", () => {
    it("allows valid bearer token", async () => {
      const app = authApp("secret");
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer secret" },
      });
      expect(res.status).toBe(200);
      expect(((await parseJson(res)) as { ok: boolean }).ok).toBe(true);
    });

    it("returns 401 for missing Authorization header", async () => {
      const app = authApp("secret");
      const res = await app.request("/test");
      expect(res.status).toBe(401);
      const body = (await parseJson(res)) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for wrong token", async () => {
      const app = authApp("secret");
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer wrong" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 for non-Bearer scheme", async () => {
      const app = authApp("secret");
      const res = await app.request("/test", {
        headers: { Authorization: "Basic secret" },
      });
      expect(res.status).toBe(401);
    });

    it("bypasses auth for OPTIONS requests", async () => {
      const app = authApp("secret");
      const res = await app.request("/test", { method: "OPTIONS" });
      expect(res.status).not.toBe(401);
    });
  });

  describe("corsMiddleware", () => {
    it("sets wildcard origin for *", async () => {
      const app = corsApp("*");
      const res = await app.request("/test", {
        headers: { Origin: "https://example.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
      expect(res.headers.get("Access-Control-Allow-Headers")).toBeTruthy();
      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "Content-Range",
      );
    });

    it("echoes allowed origin and sets Vary", async () => {
      const app = corsApp(["https://allowed.com"]);
      const res = await app.request("/test", {
        headers: { Origin: "https://allowed.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://allowed.com",
      );
      expect(res.headers.get("Vary")).toContain("Origin");
    });

    it("omits Access-Control-Allow-Origin for disallowed origin", async () => {
      const app = corsApp(["https://allowed.com"]);
      const res = await app.request("/test", {
        headers: { Origin: "https://evil.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("returns 204 for OPTIONS preflight", async () => {
      const app = corsApp("*");
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: { Origin: "https://example.com" },
      });
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
    });

    it("uses first allowed origin when no Origin header", async () => {
      const app = corsApp(["https://allowed.com", "https://other.com"]);
      const res = await app.request("/test");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://allowed.com",
      );
    });
  });

  describe("rateLimitMiddleware", () => {
    it("allows requests when under the limit", async () => {
      const app = rateLimitApp(mockRateLimit(true));
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer secret" },
      });
      expect(res.status).toBe(200);
      expect(((await parseJson(res)) as { ok: boolean }).ok).toBe(true);
    });

    it("returns 429 when rate limit exceeded", async () => {
      const app = rateLimitApp(mockRateLimit(false));
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer secret" },
      });
      expect(res.status).toBe(429);
      const body = (await parseJson(res)) as { error: { code: string } };
      expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("uses Bearer token as the default key", async () => {
      const keys: string[] = [];
      const app = rateLimitApp(mockRateLimit(true, keys));
      await app.request("/test", {
        headers: { Authorization: "Bearer my-secret-key" },
      });
      expect(keys).toEqual(["my-secret-key"]);
    });

    it("falls back to CF-Connecting-IP without Bearer token", async () => {
      const keys: string[] = [];
      const app = rateLimitApp(mockRateLimit(true, keys));
      await app.request("/test", {
        headers: { "CF-Connecting-IP": "1.2.3.4" },
      });
      expect(keys).toEqual(["1.2.3.4"]);
    });

    it("uses anonymous when no Bearer token or IP", async () => {
      const keys: string[] = [];
      const app = rateLimitApp(mockRateLimit(true, keys));
      await app.request("/test");
      expect(keys).toEqual(["anonymous"]);
    });

    it("uses custom key function when provided", async () => {
      const keys: string[] = [];
      const app = rateLimitApp(mockRateLimit(true, keys), (req) =>
        req.headers.get("X-Tenant") ? "tenant" : "default",
      );
      await app.request("/test", { headers: { "X-Tenant": "acme" } });
      expect(keys).toEqual(["tenant"]);
    });
  });

  describe("error handling", () => {
    it("maps ApiError to correct status and code", async () => {
      const app = errorsApp();
      const res = await app.request("/api-error");
      expect(res.status).toBe(404);
      const body = (await parseJson(res)) as {
        error: { code: string; message: string; details?: unknown };
      };
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("not here");
      expect(body.error.details).toEqual({ id: 5 });
    });

    it("maps validation error to 400", async () => {
      const app = errorsApp();
      const res = await app.request("/validation-error");
      expect(res.status).toBe(400);
    });

    it("maps UNIQUE constraint to 409 CONSTRAINT_VIOLATION", async () => {
      const app = errorsApp();
      const res = await app.request("/unique-constraint");
      expect(res.status).toBe(409);
      const body = (await parseJson(res)) as { error: { code: string } };
      expect(body.error.code).toBe("CONSTRAINT_VIOLATION");
    });

    it("maps NOT NULL constraint to 409", async () => {
      const app = errorsApp();
      const res = await app.request("/not-null-constraint");
      expect(res.status).toBe(409);
    });

    it("maps FOREIGN KEY constraint to 409", async () => {
      const app = errorsApp();
      const res = await app.request("/foreign-key-constraint");
      expect(res.status).toBe(409);
    });

    it("maps CHECK constraint to 409", async () => {
      const app = errorsApp();
      const res = await app.request("/check-constraint");
      expect(res.status).toBe(409);
    });

    it("maps PRIMARY KEY constraint to 409", async () => {
      const app = errorsApp();
      const res = await app.request("/primary-key-constraint");
      expect(res.status).toBe(409);
    });

    it("maps generic errors to 500 INTERNAL_ERROR", async () => {
      const app = errorsApp();
      const res = await app.request("/generic-error");
      expect(res.status).toBe(500);
      const body = (await parseJson(res)) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(body.error.message).toBe("Internal error");
    });
  });
});
