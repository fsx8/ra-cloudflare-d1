import { describe, expect, it } from "vitest";
import type { Client, InStatement, ResultSet } from "@libsql/client/web";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestWorkerDb } from "core-rest-worker";
import { createTursoRestApi } from "../src";

function resultSet(
  columns: string[],
  rows: Array<Record<string, unknown>>,
  rowsAffected = 0,
): ResultSet {
  return {
    columns,
    columnTypes: columns.map(() => ""),
    rows: rows as unknown as ResultSet["rows"],
    rowsAffected,
    lastInsertRowid: undefined,
    toJSON: () => null,
  };
}

function fakeClient(captured: { stmts: InStatement[] }): Client {
  return {
    execute(stmt: InStatement) {
      captured.stmts.push(stmt);
      return Promise.resolve(resultSet([], []));
    },
    batch(stmts: InStatement[]) {
      captured.stmts.push(...stmts);
      // list route: [data-select, count]
      return Promise.resolve([
        resultSet(["id"], [], 0),
        resultSet(["total"], [{ total: 0 }], 0),
      ]);
    },
  } as unknown as Client;
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

describe("createTursoRestApi — option resolution", () => {
  it("{ client } reuses the caller-owned libSQL client", async () => {
    const captured: { stmts: InStatement[] } = { stmts: [] };
    const { fetch } = createTursoRestApi(baseConfig(), {
      client: fakeClient(captured),
    });
    const res = await fetch(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(200);
    // The injected client received the batch — proving the factory wires the
    // caller-owned client through (not a freshly constructed one).
    expect(captured.stmts.length).toBeGreaterThan(0);
  });

  it("{ adapter } mounts a caller-supplied RestWorkerDb directly", async () => {
    const called = { count: 0 };
    const adapter = fakeAdapter(called);
    const { fetch } = createTursoRestApi(baseConfig(), { adapter });
    const res = await fetch(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(200);
    expect(called.count).toBe(1);
    expect(await res.json()).toEqual([]);
  });

  it("exports createTursoAdapter for composition", async () => {
    // Re-exported for callers who want to wrap their own client into an adapter.
    const mod = await import("../src");
    expect(typeof mod.createTursoAdapter).toBe("function");
  });
});
