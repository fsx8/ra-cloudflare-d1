export interface D1Meta {
  duration?: number;
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  served_by?: string;
  [key: string]: unknown;
}

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: D1Meta;
}

export interface D1PreparedStatement<ResultRow = Record<string, unknown>> {
  bind(...values: unknown[]): D1PreparedStatement<ResultRow>;
  all(): Promise<D1Result<ResultRow>>;
  run(): Promise<D1Result<ResultRow>>;
  first<T = ResultRow>(colName?: string): Promise<T | null>;
}

export interface D1Database {
  prepare<ResultRow = Record<string, unknown>>(
    query: string,
  ): D1PreparedStatement<ResultRow>;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
}

export type EnvWithD1<BindingName extends string = "DB"> = Record<
  BindingName,
  D1Database
>;

export function getD1Database(env: unknown, binding: string): D1Database {
  if (!env || typeof env !== "object") {
    throw new Error(`Expected env object, got ${typeof env}`);
  }
  const record = env as Record<string, unknown>;
  const db = record[binding];
  if (!db || typeof (db as { prepare?: unknown }).prepare !== "function") {
    throw new Error(`D1 binding '${binding}' not found on env`);
  }
  return db as D1Database;
}
