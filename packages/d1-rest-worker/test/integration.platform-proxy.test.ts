import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1RestApi } from "../src";

// Opt-in: only runs when INTEGRATION=1 (set in CI). Skipped by default so the
// regular `pnpm test` run does not need to spin up workerd.
const runIntegration = process.env.INTEGRATION === "1";
const describeIntegration = runIntegration ? describe : describe.skip;

const app = createD1RestApi({
  apiKey: "test_key",
  corsOrigins: "*",
  resources: {
    posts: {
      tableName: "posts",
      idField: "id",
      selectableFields: ["id", "title"],
      filterableFields: ["id", "title"],
      sortableFields: ["id", "title"],
      searchableFields: ["title"],
    },
  },
});

describeIntegration("platform-proxy integration", () => {
  // Lazily created in beforeAll so workerd is never started when the suite is
  // skipped (keeps the default `pnpm test` fast and dependency-free).
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: "./wrangler.jsonc",
    });
    const db = proxy.env.DB;
    await db.exec("DROP TABLE IF EXISTS posts;");
    await db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);");
    await db.exec("INSERT INTO posts (title) VALUES ('Hello');");
  });

  afterAll(async () => {
    await proxy?.dispose();
  });

  it("serves list endpoint", async () => {
    const url =
      "http://localhost/api/posts?sort=%5B%22id%22%2C%22ASC%22%5D&range=%5B0%2C9%5D&filter=%7B%7D";
    const res = await app.fetch(
      new Request(url, { headers: { Authorization: "Bearer test_key" } }),
      proxy.env,
      proxy.ctx,
    );
    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect((json as Array<{ title: string }>)[0]?.title).toBe("Hello");
  });
});
