import type { D1Database, D1Result } from "../src/types";

export interface CapturedStatement {
  sql: string;
  binds: unknown[];
}

export type PrepareHandler = (
  sql: string,
  binds: unknown[],
) => D1Result | Promise<D1Result>;

export type BatchHandler = (
  statements: CapturedStatement[],
) => D1Result[] | Promise<D1Result[]>;

interface FakePreparedStatement {
  __sql: string;
  __binds: unknown[];
  bind(...values: unknown[]): FakePreparedStatement;
  all(): Promise<D1Result>;
  run(): Promise<D1Result>;
  first(): Promise<Record<string, unknown> | null>;
}

function makeStatement(
  sql: string,
  binds: unknown[],
  prepareHandler: PrepareHandler,
  captured: CapturedStatement[],
): FakePreparedStatement {
  return {
    __sql: sql,
    __binds: binds,
    bind(...values: unknown[]) {
      return makeStatement(
        sql,
        [...binds, ...values],
        prepareHandler,
        captured,
      );
    },
    async all() {
      captured.push({ sql, binds });
      return prepareHandler(sql, binds);
    },
    async run() {
      captured.push({ sql, binds });
      return prepareHandler(sql, binds);
    },
    async first() {
      captured.push({ sql, binds });
      const res = await prepareHandler(sql, binds);
      return res.results?.[0] ?? null;
    },
  };
}

export function makeFakeDb(
  prepareHandler: PrepareHandler,
  batchHandler?: BatchHandler,
): { db: D1Database; captured: CapturedStatement[] } {
  const captured: CapturedStatement[] = [];

  const db = {
    prepare(sql: string) {
      return makeStatement(sql, [], prepareHandler, captured);
    },
    async batch(statements: FakePreparedStatement[]) {
      const capturedStmts: CapturedStatement[] = statements.map((s) => {
        captured.push({ sql: s.__sql, binds: s.__binds });
        return { sql: s.__sql, binds: s.__binds };
      });
      if (batchHandler) return batchHandler(capturedStmts);
      return Promise.all(statements.map((s) => s.all()));
    },
  };

  return { db: db as unknown as D1Database, captured };
}

export function okResult(
  results: Record<string, unknown>[] = [],
  meta: Record<string, unknown> = {},
): D1Result {
  return {
    success: true,
    results,
    meta: { changes: results.length, ...meta },
  };
}

export function emptyResult(changes = 0): D1Result {
  return { success: true, results: [], meta: { changes } };
}
