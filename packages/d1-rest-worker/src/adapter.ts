import type { D1Database } from "./types.js";
import type { DbStatement, ExecResult, RestWorkerDb } from "core-rest-worker";

export function createD1Adapter(d1: D1Database): RestWorkerDb {
  return {
    async execute(sql, params) {
      const res = await d1
        .prepare(sql)
        .bind(...params)
        .all();
      return {
        rows: res.results ?? [],
        changes: res.meta?.changes ?? 0,
      };
    },
    async executeMany(statements: DbStatement[]): Promise<ExecResult[]> {
      const prepared = statements.map((s) =>
        d1.prepare(s.sql).bind(...s.params),
      );
      const results = await d1.batch(prepared);
      return results.map((r) => ({
        rows: r.results ?? [],
        changes: r.meta?.changes ?? 0,
      }));
    },
  };
}
