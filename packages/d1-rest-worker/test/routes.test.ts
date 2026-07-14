import { describe, expect, it } from "vitest";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { createApp } from "../src/app";
import {
  makeFakeDb,
  okResult,
  emptyResult,
  type PrepareHandler,
  type BatchHandler,
} from "./helpers";

const API_KEY = "test-key";

async function parseJson(res: Response): Promise<unknown> {
  return res.json();
}

function makeConfig(overrides?: Partial<D1RestConfig>): D1RestConfig {
  return {
    apiKey: API_KEY,
    corsOrigins: "*",
    resources: {
      posts: {
        tableName: "posts",
        idField: "id",
        selectableFields: ["id", "title", "body"],
        filterableFields: ["id", "title", "body"],
        sortableFields: ["id", "title"],
        searchableFields: ["title", "body"],
      },
    },
    ...overrides,
  };
}

function setup(opts?: {
  config?: Partial<D1RestConfig>;
  prepareHandler?: PrepareHandler;
  batchHandler?: BatchHandler;
}) {
  const { db, captured } = makeFakeDb(
    opts?.prepareHandler ?? (() => okResult([])),
    opts?.batchHandler,
  );
  const config = makeConfig(opts?.config);
  const app = createApp(config);
  const env = { DB: db };
  return { db, captured, app, config, env };
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_KEY}` };
}

function jsonBody(body: unknown): string {
  return JSON.stringify(body);
}

describe("routes", () => {
  describe("GET /:resource (list)", () => {
    it("returns data array with Content-Range and X-Total-Count", async () => {
      const data = [
        { id: 1, title: "A", body: "b1" },
        { id: 2, title: "B", body: "b2" },
      ];
      const { app, env } = setup({
        batchHandler: (stmts) =>
          stmts.map((s) =>
            s.sql.includes("COUNT") ? okResult([{ total: 2 }]) : okResult(data),
          ),
      });

      const res = await app.request(
        "/api/posts?sort=%5B%22id%22%2C%22ASC%22%5D&range=%5B0%2C24%5D&filter=%7B%7D",
        { headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as unknown[];
      expect(json).toHaveLength(2);
      expect((json as Array<{ id: number }>)[0].id).toBe(1);
      expect(res.headers.get("Content-Range")).toBe("posts 0-1/2");
      expect(res.headers.get("X-Total-Count")).toBe("2");
    });

    it("returns 403 for unknown resource", async () => {
      const { app, env } = setup();
      const res = await app.request(
        "/api/unknown",
        { headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 401 without auth", async () => {
      const { app, env } = setup();
      const res = await app.request("/api/posts", {}, env);
      expect(res.status).toBe(401);
    });

    it("applies soft-delete filter", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        batchHandler: (stmts) =>
          stmts.map((s) =>
            s.sql.includes("COUNT") ? okResult([{ total: 0 }]) : okResult([]),
          ),
      });

      await app.request("/api/posts", { headers: authHeaders() }, env);

      const batchSql = captured.find((c) => c.sql.includes("SELECT"));
      expect(batchSql?.sql).toContain("deleted_at IS NULL");
    });
  });

  describe("GET /:resource/:id (one)", () => {
    it("returns a single record", async () => {
      const { app, env } = setup({
        prepareHandler: () => okResult([{ id: 1, title: "A", body: "b" }]),
      });

      const res = await app.request(
        "/api/posts/1",
        { headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as { id: number; title: string };
      expect(json.id).toBe(1);
      expect(json.title).toBe("A");
    });

    it("returns 404 when not found", async () => {
      const { app, env } = setup({
        prepareHandler: () => emptyResult(),
      });

      const res = await app.request(
        "/api/posts/999",
        { headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("excludes soft-deleted records", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => okResult([{ id: 1, title: "A" }]),
      });

      await app.request("/api/posts/1", { headers: authHeaders() }, env);
      expect(captured[0].sql).toContain("deleted_at IS NULL");
    });

    it("includes soft-deleted records with includeDeleted=true", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => okResult([{ id: 1, title: "A" }]),
      });

      await app.request(
        "/api/posts/1?includeDeleted=true",
        { headers: authHeaders() },
        env,
      );
      expect(captured[0].sql).not.toContain("deleted_at IS NULL");
    });
  });

  describe("POST /:resource (create)", () => {
    it("creates a record and returns 201", async () => {
      const { app, env, captured } = setup({
        prepareHandler: () => okResult([{ id: 1, title: "New", body: "b" }]),
      });

      const res = await app.request(
        "/api/posts",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ title: "New", body: "b" }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const json = (await parseJson(res)) as { id: number; title: string };
      expect(json.id).toBe(1);
      expect(json.title).toBe("New");
      expect(captured[0].sql).toContain("INSERT INTO posts");
    });

    it("returns 400 for empty body", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({}),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: "not json",
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("accepts a client-supplied primary key", async () => {
      const config: Partial<D1RestConfig> = {
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
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => okResult([{ id: 42, title: "A" }]),
      });

      const res = await app.request(
        "/api/posts",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ id: 42, title: "A" }),
        },
        env,
      );

      expect(res.status).toBe(201);
      expect(captured[0].sql).toContain("(id, title)");
      expect(captured[0].binds).toEqual([42, "A"]);
    });
  });

  describe("PUT /:resource/:id (update)", () => {
    it("updates and returns the record", async () => {
      const { app, env, captured } = setup({
        prepareHandler: () =>
          okResult([{ id: 1, title: "Updated", body: "b" }]),
      });

      const res = await app.request(
        "/api/posts/1",
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ title: "Updated" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as { title: string };
      expect(json.title).toBe("Updated");
      expect(captured[0].sql).toContain("UPDATE posts SET");
      expect(captured[0].sql).toContain("RETURNING");
    });

    it("returns 404 when record not found", async () => {
      const { app, env } = setup({
        prepareHandler: () => emptyResult(),
      });

      const res = await app.request(
        "/api/posts/999",
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ title: "X" }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 when no fields to update", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts/1",
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ id: 1 }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("applies soft-delete guard", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => okResult([{ id: 1, title: "A" }]),
      });

      await app.request(
        "/api/posts/1",
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ title: "A" }),
        },
        env,
      );

      expect(captured[0].sql).toContain("deleted_at IS NULL");
    });
  });

  describe("DELETE /:resource/:id (delete)", () => {
    it("hard-deletes a record", async () => {
      const { app, env, captured } = setup({
        prepareHandler: () => emptyResult(1),
      });

      const res = await app.request(
        "/api/posts/1",
        { method: "DELETE", headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as { id: string };
      expect(json.id).toBe("1");
      expect(captured[0].sql).toContain("DELETE FROM posts");
    });

    it("returns 404 when record not found", async () => {
      const { app, env } = setup({
        prepareHandler: () => emptyResult(0),
      });

      const res = await app.request(
        "/api/posts/999",
        { method: "DELETE", headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("soft-deletes when configured", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => emptyResult(1),
      });

      const res = await app.request(
        "/api/posts/1",
        { method: "DELETE", headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(200);
      expect(captured[0].sql).toContain("UPDATE posts SET deleted_at");
      expect(captured[0].sql).toContain("CURRENT_TIMESTAMP");
    });

    it("soft-deletes with boolean field", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted", type: "boolean" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        prepareHandler: () => emptyResult(1),
      });

      await app.request(
        "/api/posts/1",
        { method: "DELETE", headers: authHeaders() },
        env,
      );

      expect(captured[0].sql).toContain("SET deleted = 1");
    });
  });

  describe("POST /:resource/__bulkUpdate", () => {
    it("updates multiple records and returns ids", async () => {
      const { app, env } = setup({
        batchHandler: (stmts) => stmts.map(() => emptyResult(2)),
      });

      const res = await app.request(
        "/api/posts/__bulkUpdate",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1, 2], data: { title: "X" } }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as { data: number[] };
      expect(json.data).toEqual([1, 2]);
    });

    it("returns 404 when no records match", async () => {
      const { app, env } = setup({
        batchHandler: (stmts) => stmts.map(() => emptyResult(0)),
      });

      const res = await app.request(
        "/api/posts/__bulkUpdate",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1, 2], data: { title: "X" } }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts/__bulkUpdate",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1] }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when no fields to update", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts/__bulkUpdate",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1], data: {} }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("applies soft-delete guard", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        batchHandler: (stmts) => stmts.map(() => emptyResult(1)),
      });

      await app.request(
        "/api/posts/__bulkUpdate",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1], data: { title: "X" } }),
        },
        env,
      );

      expect(captured[0].sql).toContain("deleted_at IS NULL");
    });
  });

  describe("POST /:resource/__bulkDelete", () => {
    it("deletes multiple records and returns ids", async () => {
      const { app, env } = setup({
        batchHandler: (stmts) => stmts.map(() => emptyResult(2)),
      });

      const res = await app.request(
        "/api/posts/__bulkDelete",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1, 2] }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as { data: number[] };
      expect(json.data).toEqual([1, 2]);
    });

    it("returns 404 when no records match", async () => {
      const { app, env } = setup({
        batchHandler: (stmts) => stmts.map(() => emptyResult(0)),
      });

      const res = await app.request(
        "/api/posts/__bulkDelete",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1, 2] }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      const { app, env } = setup();

      const res = await app.request(
        "/api/posts/__bulkDelete",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({}),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("soft-deletes when configured", async () => {
      const config: Partial<D1RestConfig> = {
        resources: {
          posts: {
            tableName: "posts",
            idField: "id",
            selectableFields: ["id", "title"],
            filterableFields: ["id", "title"],
            sortableFields: ["id", "title"],
            searchableFields: ["title"],
            softDelete: { field: "deleted_at", type: "timestamp" },
          },
        },
      };
      const { app, env, captured } = setup({
        config,
        batchHandler: (stmts) => stmts.map(() => emptyResult(1)),
      });

      await app.request(
        "/api/posts/__bulkDelete",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: jsonBody({ ids: [1] }),
        },
        env,
      );

      expect(captured[0].sql).toContain("SET deleted_at = CURRENT_TIMESTAMP");
    });
  });

  describe("GET /__schema", () => {
    it("returns schema for all resources", async () => {
      const { app, env } = setup({
        prepareHandler: () =>
          okResult([
            {
              cid: 0,
              name: "id",
              type: "INTEGER",
              notnull: 1,
              dflt_value: null,
              pk: 1,
            },
            {
              cid: 1,
              name: "title",
              type: "TEXT",
              notnull: 0,
              dflt_value: null,
              pk: 0,
            },
          ]),
      });

      const res = await app.request(
        "/api/__schema",
        { headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await parseJson(res)) as {
        resources: Record<
          string,
          { fields: Array<{ name: string; type: string; primaryKey: boolean }> }
        >;
      };
      expect(json.resources.posts.fields).toHaveLength(2);
      expect(json.resources.posts.fields[0].name).toBe("id");
      expect(json.resources.posts.fields[0].primaryKey).toBe(true);
    });

    it("returns 404 when disabled", async () => {
      const { app, env } = setup({
        config: { enableSchemaEndpoint: false },
      });

      const res = await app.request(
        "/api/__schema",
        { headers: authHeaders() },
        env,
      );

      expect(res.status).toBe(404);
    });
  });
});
