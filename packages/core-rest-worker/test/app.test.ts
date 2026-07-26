import { describe, expect, it } from "vitest";
import type { RestWorkerConfig } from "rest-worker-types";
import { createRestApp } from "../src/app";
import type { RestWorkerDb } from "../src/db";

function fakeDb(): RestWorkerDb {
  return {
    execute: () => Promise.resolve({ rows: [], changes: 0 }),
    executeMany: (statements) =>
      Promise.resolve(
        // list route issues [data-select, count]; return empty data + total 0.
        statements.map((s) =>
          /COUNT/i.test(s.sql)
            ? { rows: [{ total: 0 }], changes: 0 }
            : { rows: [], changes: 0 },
        ),
      ),
  };
}

function baseConfig(overrides?: Partial<RestWorkerConfig>): RestWorkerConfig {
  return {
    corsOrigins: "*",
    resources: {
      posts: {
        tableName: "posts",
        idField: "id",
        selectableFields: ["id", "title"],
        filterableFields: ["id", "title"],
        sortableFields: ["id"],
        searchableFields: ["title"],
      },
    },
    ...overrides,
  };
}

function appWith(overrides?: Partial<RestWorkerConfig>) {
  return createRestApp(baseConfig(overrides), { adapter: () => fakeDb() });
}

describe("createRestApp — requireApiKey", () => {
  it("enforces bearer auth by default (rejects request without token)", async () => {
    const app = appWith({ apiKey: "secret" });
    const res = await app.request("/api/posts");
    expect(res.status).toBe(401);
  });

  it("accepts a request with a matching bearer token by default", async () => {
    const app = appWith({ apiKey: "secret" });
    const res = await app.request("/api/posts", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(res.status).toBe(200);
  });

  it("skips auth when requireApiKey is false (no token, no apiKey)", async () => {
    const app = appWith({ requireApiKey: false });
    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("ignores apiKey entirely when requireApiKey is false", async () => {
    const app = appWith({ requireApiKey: false, apiKey: "ignored" });
    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
  });

  it("still enforces auth when requireApiKey is explicitly true", async () => {
    const app = appWith({ requireApiKey: true, apiKey: "secret" });
    const noToken = await app.request("/api/posts");
    expect(noToken.status).toBe(401);
    const withToken = await app.request("/api/posts", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(withToken.status).toBe(200);
  });

  it("throws at construction when auth is on but apiKey is missing", () => {
    expect(() => appWith({ apiKey: undefined })).toThrow(/apiKey is required/);
  });

  it("does not throw when requireApiKey is false and apiKey is absent", () => {
    expect(() => appWith({ requireApiKey: false })).not.toThrow();
  });

  it("applies CORS even when auth is off", async () => {
    const app = appWith({ requireApiKey: false, corsOrigins: "*" });
    const res = await app.request("/api/posts", {
      headers: { Origin: "https://example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
