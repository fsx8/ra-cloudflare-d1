import type { Context } from "hono";
import type {
  D1RestConfig,
  SchemaFieldInfo,
  SchemaResponse,
} from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { validateIdentifier } from "../sql/validator.js";
import { getD1Database } from "../types.js";

type PragmaTableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export async function schemaRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  if (config.enableSchemaEndpoint === false) {
    throw new ApiError("NOT_FOUND", "Schema endpoint disabled");
  }
  const db = getD1Database(c.env, dbBinding);

  const resources: SchemaResponse["resources"] = {};
  for (const [resourceName, rc] of Object.entries(config.resources)) {
    const table = validateIdentifier(rc.tableName, "table");
    const res = await db
      .prepare<PragmaTableInfoRow>(`PRAGMA table_info(${table})`)
      .all();
    const rows = res.results ?? [];
    const fields = rows.map((r) => {
      const transform: SchemaFieldInfo["transform"] =
        rc.transforms?.booleans?.includes(r.name)
          ? "boolean"
          : rc.transforms?.dates?.includes(r.name)
            ? "date"
            : rc.transforms?.json?.includes(r.name)
              ? "json"
              : undefined;
      return {
        name: r.name,
        type: r.type,
        nullable: r.notnull === 0,
        primaryKey: r.pk === 1,
        defaultValue: r.dflt_value,
        transform,
      };
    });

    resources[resourceName] = {
      fields,
      filterable: rc.filterableFields,
      sortable: rc.sortableFields,
      searchable: rc.searchableFields,
    };
  }

  return c.json({ resources });
}
