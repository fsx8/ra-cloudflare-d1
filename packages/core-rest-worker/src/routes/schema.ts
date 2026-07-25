import type { Context } from "hono";
import type {
  RestWorkerConfig,
  SchemaFieldInfo,
  SchemaResponse,
} from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { validateIdentifier } from "../sql/validator.js";

export async function schemaRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  if (config.enableSchemaEndpoint === false) {
    throw new ApiError("NOT_FOUND", "Schema endpoint disabled");
  }
  const db = c.get("db");

  const resources: SchemaResponse["resources"] = {};
  for (const [resourceName, rc] of Object.entries(config.resources)) {
    const table = validateIdentifier(rc.tableName, "table");
    const res = await db.execute(`PRAGMA table_info(${table})`, []);
    const rows = res.rows;
    const fields = rows.map((r) => {
      const name = typeof r.name === "string" ? r.name : "";
      const transform: SchemaFieldInfo["transform"] =
        rc.transforms?.booleans?.includes(name)
          ? "boolean"
          : rc.transforms?.dates?.includes(name)
            ? "date"
            : rc.transforms?.json?.includes(name)
              ? "json"
              : undefined;
      return {
        name,
        type: typeof r.type === "string" ? r.type : "",
        nullable: Number(r.notnull ?? 1) === 0,
        primaryKey: Number(r.pk ?? 0) === 1,
        defaultValue: typeof r.dflt_value === "string" ? r.dflt_value : null,
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
