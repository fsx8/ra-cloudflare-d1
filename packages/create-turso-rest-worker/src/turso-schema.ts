import { createClient } from "@libsql/client";
import type { ResourceConfig } from "rest-worker-types";
import type { TursoAnswers } from "./prompts.js";

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validateIdentifier(identifier: string, context: string): string {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Invalid ${context} identifier: ${identifier}`);
  }
  return identifier;
}

type SqliteMasterRow = { name: string };
type PragmaTableInfoRow = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

function inferTransforms(columns: PragmaTableInfoRow[]) {
  const booleans: string[] = [];
  const dates: string[] = [];
  for (const col of columns) {
    const n = col.name.toLowerCase();
    const t = col.type.toUpperCase();
    if (
      t.includes("INT") &&
      (n.startsWith("is_") || n.startsWith("has_") || n.endsWith("_flag"))
    ) {
      booleans.push(col.name);
    }
    if (
      t.includes("TEXT") &&
      (n.endsWith("_at") || n.endsWith("_date") || n.includes("timestamp"))
    ) {
      dates.push(col.name);
    }
  }
  return { booleans, dates };
}

function inferSoftDelete(columns: PragmaTableInfoRow[]) {
  const deletedAt = columns.find((c) => c.name === "deleted_at");
  if (deletedAt) return { field: "deleted_at", type: "timestamp" as const };
  const deleted = columns.find((c) => c.name === "deleted");
  if (deleted) return { field: "deleted", type: "boolean" as const };
  return undefined;
}

export function buildResource(
  tableName: string,
  columns: PragmaTableInfoRow[],
): ResourceConfig {
  const pk = columns.find((c) => c.pk === 1)?.name ?? "id";
  const selectable = columns.map((c) => c.name);
  const searchable = columns
    .filter((c) => c.type.toUpperCase().includes("TEXT"))
    .map((c) => c.name);
  const transforms = inferTransforms(columns);
  return {
    tableName,
    idField: pk,
    selectableFields: selectable,
    filterableFields: selectable,
    sortableFields: selectable,
    searchableFields: searchable,
    softDelete: inferSoftDelete(columns),
    transforms: {
      booleans: transforms.booleans,
      dates: transforms.dates,
    },
  };
}

export async function discoverSchema(turso: TursoAnswers) {
  const client = createClient({
    url: turso.tursoUrl,
    authToken: turso.tursoAuthToken,
  });

  try {
    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tables: SqliteMasterRow[] = tablesRes.rows.map((r) => ({
      name: typeof r.name === "string" ? r.name : "",
    }));

    const resources: Record<string, ResourceConfig> = {};
    for (const t of tables) {
      const columnsRes = await client.execute(
        `PRAGMA table_info(${validateIdentifier(t.name, "table")});`,
      );
      const columns: PragmaTableInfoRow[] = columnsRes.rows.map((r) => ({
        name: typeof r.name === "string" ? r.name : "",
        type: typeof r.type === "string" ? r.type : "",
        notnull: typeof r.notnull === "number" ? r.notnull : 0,
        pk: typeof r.pk === "number" ? r.pk : 0,
      }));
      resources[t.name] = buildResource(t.name, columns);
    }

    return {
      tables,
      resources,
    };
  } finally {
    client.close();
  }
}
