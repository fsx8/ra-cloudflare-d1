import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { softDeleteCondition } from "../sql/builder.js";
import { chunkBulkDelete } from "../sql/chunker.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";

export async function bulkDeleteRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  const body = await c.req
    .json<{ ids?: Array<string | number> }>()
    .catch(() => null);
  if (!body || !Array.isArray(body.ids)) {
    throw new ApiError("VALIDATION_ERROR", "Body must be { ids: [] }");
  }
  const ids = body.ids;
  if (ids.length === 0) return c.json({ data: [] });

  const chunks = chunkBulkDelete(ids);
  const softCond = softDeleteCondition(rc);
  const softSql = softCond ? ` AND ${softCond}` : "";
  const statements = chunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(",");
    if (rc.softDelete) {
      const field = validateIdentifier(rc.softDelete.field, "softDelete field");
      const valueExpr =
        rc.softDelete.type === "boolean" ? "1" : "CURRENT_TIMESTAMP";
      return {
        sql: `UPDATE ${rc.tableName} SET ${field} = ${valueExpr} WHERE ${rc.idField} IN (${placeholders})${softSql}`,
        params: [...chunk],
      };
    }
    return {
      sql: `DELETE FROM ${rc.tableName} WHERE ${rc.idField} IN (${placeholders})`,
      params: [...chunk],
    };
  });

  let results;
  try {
    results = await db.executeMany(statements);
  } catch (err) {
    throw new ApiError("INTERNAL_ERROR", "Bulk delete failed.", {
      resource,
      ids,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const affected = results.reduce((sum, r) => sum + r.changes, 0);
  if (affected === 0) {
    throw new ApiError("NOT_FOUND", `No records found to delete`, {
      resource,
      ids,
    });
  }
  return c.json({ data: ids });
}
