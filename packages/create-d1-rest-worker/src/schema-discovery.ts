import type { ResourceConfig } from "@ra-cloudflare-d1/types";
import { CloudflareApiClient } from "./cloudflare-api.js";
import type { CloudflareAnswers } from "./prompts.js";

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

export async function discoverSchema(cf: CloudflareAnswers) {
  const client = new CloudflareApiClient({
    accountId: cf.accountId,
    apiToken: cf.apiToken,
  });

  const tables = await client.queryD1<SqliteMasterRow>(
    cf.databaseId,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  const resources: Record<string, ResourceConfig> = {};
  for (const t of tables) {
    const columns = await client.queryD1<PragmaTableInfoRow>(
      cf.databaseId,
      `PRAGMA table_info(${validateIdentifier(t.name, "table")});`,
    );
    const pk = columns.find((c) => c.pk === 1)?.name ?? "id";
    const selectable = columns.map((c) => c.name);
    const searchable = columns
      .filter((c) => c.type.toUpperCase().includes("TEXT"))
      .map((c) => c.name);
    const transforms = inferTransforms(columns);

    resources[t.name] = {
      tableName: t.name,
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

  return {
    tables,
    resources,
  };
}
