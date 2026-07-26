import { describe, expect, it } from "vitest";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestWorkerDb } from "core-rest-worker";
import { createApp, type D1RestApiOptions } from "../src/app";
import { createD1RestApi } from "../src";
import { makeFakeDb, okResult, type PrepareHandler } from "./helpers";

function listPrepareHandler(): PrepareHandler {
  return (sql) =>
    /COUNT/i.test(sql) ? okResult([{ total: 0 }]) : okResult([]);
}

function baseConfig(overrides?: Partial<RestWorkerConfig>): RestWorkerConfig {
  return {
    corsOrigins: "*",
    requireApiKey: false,
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

function fakeAdapter(called: { count: number }): RestWorkerDb {
  return {
    execute: () => {
      called.count++;
      return Promise.resolve({ rows: [], changes: 0 });
    },
    executeMany: () => {
      called.count++;
      return Promise.resolve([
        { rows: [], changes: 0 },
        { rows: [{ total: 0 }], changes: 0 },
      ]);
    },
  };
}

describe("createApp / createD1RestApi — option resolution", () => {
  it("{ adapter } uses the injected adapter and ignores env", async () => {
    const called = { count: 0 };
    const opts: D1RestApiOptions = { adapter: fakeAdapter(called) };
    const app = createApp(baseConfig(), opts);
    // No env binding present at all — the adapter is env-independent.
    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
    expect(called.count).toBe(1);
  });

  it("{ dbBinding } resolves a custom-named binding from env", async () => {
    const { db } = makeFakeDb(listPrepareHandler());
    const app = createApp(baseConfig(), { dbBinding: "MY_DB" });
    const res = await app.request("/api/posts", {}, { MY_DB: db });
    expect(res.status).toBe(200);
  });

  it("default (no opts) resolves the 'DB' binding", async () => {
    const { db } = makeFakeDb(listPrepareHandler());
    const app = createApp(baseConfig());
    const res = await app.request("/api/posts", {}, { DB: db });
    expect(res.status).toBe(200);
  });

  it("returns 500 when the named binding is missing", async () => {
    const app = createApp(baseConfig(), { dbBinding: "MISSING" });
    const { db } = makeFakeDb(listPrepareHandler());
    const res = await app.request("/api/posts", {}, { DB: db });
    expect(res.status).toBe(500);
  });

  it("createD1RestApi({ adapter }) works end-to-end without a binding", async () => {
    const called = { count: 0 };
    const { fetch } = createD1RestApi(baseConfig(), {
      adapter: fakeAdapter(called),
    });
    const res = await fetch(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(200);
    expect(called.count).toBe(1);
  });

  it("exports createD1Adapter for composition", async () => {
    const mod = await import("../src");
    expect(typeof mod.createD1Adapter).toBe("function");
  });
});
