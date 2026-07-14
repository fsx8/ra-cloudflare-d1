import type { Context } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { softDeleteCondition } from "../sql/builder.js";
import { chunkBulkDelete } from "../sql/chunker.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";
import { getD1Database } from "../types.js";

export async function bulkDeleteRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = getD1Database(c.env, dbBinding);

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
      return db
        .prepare(
          `UPDATE ${rc.tableName} SET ${field} = ${valueExpr} WHERE ${rc.idField} IN (${placeholders})${softSql}`,
        )
        .bind(...chunk);
    }
    return db
      .prepare(
        `DELETE FROM ${rc.tableName} WHERE ${rc.idField} IN (${placeholders})`,
      )
      .bind(...chunk);
  });

  let results;
  try {
    results = await db.batch(statements);
  } catch (err) {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Bulk delete failed — earlier chunks may have already committed (D1 batch is not transactional).",
      {
        resource,
        ids,
        error: err instanceof Error ? err.message : String(err),
      },
    );
  }
  const affected = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
  if (affected === 0) {
    throw new ApiError("NOT_FOUND", `No records found to delete`, {
      resource,
      ids,
    });
  }
  return c.json({ data: ids });
}
