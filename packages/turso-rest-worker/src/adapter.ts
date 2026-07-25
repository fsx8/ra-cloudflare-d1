import type { Client, InValue, Row } from "@libsql/client/web";
import type {
  DbRow,
  DbStatement,
  ExecResult,
  RestWorkerDb,
} from "core-rest-worker";

function rowToObject(columns: string[], row: Row): DbRow {
  const obj: Record<string, unknown> = {};
  for (const col of columns) {
    obj[col] = row[col];
  }
  return obj;
}

export function createTursoAdapter(client: Client): RestWorkerDb {
  return {
    async execute(sql, params) {
      const res = await client.execute({ sql, args: params as InValue[] });
      return {
        rows: res.rows.map((row) => rowToObject(res.columns, row)),
        changes: res.rowsAffected,
      };
    },
    async executeMany(statements: DbStatement[]): Promise<ExecResult[]> {
      const batch = statements.map((s) => ({
        sql: s.sql,
        args: s.params as InValue[],
      }));
      const results = await client.batch(batch);
      return results.map((res) => ({
        rows: res.rows.map((row) => rowToObject(res.columns, row)),
        changes: res.rowsAffected,
      }));
    },
  };
}
