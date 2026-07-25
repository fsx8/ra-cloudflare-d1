import { describe, expect, it } from "vitest";
import type { Client, InStatement, ResultSet } from "@libsql/client/web";
import { createTursoAdapter } from "../src/adapter";

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

interface FakeClientOpts {
  result?: ResultSet;
  results?: ResultSet[];
  captured?: { stmts: InStatement[] };
}

function fakeClient(opts: FakeClientOpts): Client {
  return {
    execute(stmt: InStatement) {
      opts.captured?.stmts.push(stmt);
      return Promise.resolve(opts.result ?? resultSet([], []));
    },
    batch(stmts: InStatement[]) {
      opts.captured?.stmts.push(...stmts);
      return Promise.resolve(
        opts.results ?? [opts.result ?? resultSet([], [])],
      );
    },
  } as unknown as Client;
}

describe("createTursoAdapter", () => {
  it("execute maps rows by column name and rowsAffected to changes", async () => {
    const client = fakeClient({
      result: resultSet(["id", "title"], [{ id: 1, title: "hi" }], 1),
    });
    const db = createTursoAdapter(client);
    const res = await db.execute("SELECT id, title FROM posts", []);
    expect(res.rows).toEqual([{ id: 1, title: "hi" }]);
    expect(res.changes).toBe(1);
  });

  it("execute forwards params as args", async () => {
    const captured: { stmts: InStatement[] } = { stmts: [] };
    const client = fakeClient({
      result: resultSet([], []),
      captured,
    });
    const db = createTursoAdapter(client);
    await db.execute("SELECT * FROM posts WHERE id = ?", [42]);
    expect(captured.stmts).toEqual([
      { sql: "SELECT * FROM posts WHERE id = ?", args: [42] },
    ]);
  });

  it("executeMany maps each result and forwards statements", async () => {
    const captured: { stmts: InStatement[] } = { stmts: [] };
    const client = fakeClient({
      results: [
        resultSet(["id"], [{ id: 1 }, { id: 2 }], 2),
        resultSet(["total"], [{ total: 5 }], 0),
      ],
      captured,
    });
    const db = createTursoAdapter(client);
    const res = await db.executeMany([
      { sql: "SELECT id FROM posts", params: [] },
      { sql: "SELECT COUNT(*) as total FROM posts", params: [] },
    ]);
    expect(res).toHaveLength(2);
    expect(res[0].rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(res[0].changes).toBe(2);
    expect(res[1].rows).toEqual([{ total: 5 }]);
    expect(res[1].changes).toBe(0);
    expect(captured.stmts).toEqual([
      { sql: "SELECT id FROM posts", args: [] },
      { sql: "SELECT COUNT(*) as total FROM posts", args: [] },
    ]);
  });

  it("drops array-like row artifacts, keeping only named columns", async () => {
    const client = fakeClient({
      result: resultSet(["title"], [{ 0: "x", title: "real", length: 1 }]),
    });
    const db = createTursoAdapter(client);
    const res = await db.execute("SELECT title FROM posts", []);
    expect(res.rows).toEqual([{ title: "real" }]);
  });

  it("execute returns empty rows and changes=0 for an empty result set", async () => {
    const client = fakeClient({ result: resultSet(["id", "title"], [], 0) });
    const db = createTursoAdapter(client);
    const res = await db.execute("SELECT * FROM posts WHERE 1=0", []);
    expect(res.rows).toEqual([]);
    expect(res.changes).toBe(0);
  });

  it("execute preserves row order across many rows", async () => {
    const client = fakeClient({
      result: resultSet(["id"], [{ id: 3 }, { id: 1 }, { id: 2 }], 0),
    });
    const db = createTursoAdapter(client);
    const res = await db.execute("SELECT id FROM posts", []);
    expect(res.rows.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("execute ignores lastInsertRowid and reports changes only", async () => {
    const result = resultSet(["id"], [], 5);
    (result as { lastInsertRowid?: unknown }).lastInsertRowid = 99;
    const client = fakeClient({ result });
    const db = createTursoAdapter(client);
    const res = await db.execute("INSERT INTO posts (title) VALUES (?)", ["x"]);
    expect(res.changes).toBe(5);
    expect(res.rows).toEqual([]);
  });

  it("executeMany with an empty statement list returns an empty list", async () => {
    const client = fakeClient({ results: [] });
    const db = createTursoAdapter(client);
    const res = await db.executeMany([]);
    expect(res).toEqual([]);
  });
});
