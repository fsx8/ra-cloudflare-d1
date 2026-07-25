export type DbRow = Record<string, unknown>;

export interface ExecResult {
  rows: DbRow[];
  changes: number;
}

export interface DbStatement {
  sql: string;
  params: unknown[];
}

export interface RestWorkerDb {
  execute(sql: string, params: unknown[]): Promise<ExecResult>;
  executeMany(statements: DbStatement[]): Promise<ExecResult[]>;
}

export type RestAppEnv = { Variables: { db: RestWorkerDb } };
