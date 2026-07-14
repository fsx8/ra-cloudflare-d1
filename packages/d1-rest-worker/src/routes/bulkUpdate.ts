import type { Context } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { softDeleteCondition } from "../sql/builder.js";
import { chunkBulkUpdate } from "../sql/chunker.js";
import { validateField, validateResource } from "../sql/validator.js";
import { getD1Database } from "../types.js";

export async function bulkUpdateRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = getD1Database(c.env, dbBinding);

  const body = await c.req
    .json<{ ids?: Array<string | number>; data?: Record<string, unknown> }>()
    .catch(() => null);
  if (
    !body ||
    !Array.isArray(body.ids) ||
    !body.data ||
    typeof body.data !== "object"
  ) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Body must be { ids: [], data: {} }",
    );
  }

  const ids = body.ids;
  if (ids.length === 0) return c.json({ data: [] });
  const data = body.data;

  const keys = Object.keys(data).filter((k) => k !== rc.idField);
  if (keys.length === 0)
    throw new ApiError("VALIDATION_ERROR", "No fields to update");

  const columns = keys.map((k) =>
    validateField(k, rc.selectableFields, "selectable"),
  );
  const assigns = columns.map((col) => `${col} = ?`).join(", ");
  const values = keys.map((k) => data[k]);

  const chunks = chunkBulkUpdate(ids, columns.length);
  const statements = chunks.map((chunk) => {
    const placeholders = chunk.map(() => "?").join(",");
    const softCond = softDeleteCondition(rc);
    const softSql = softCond ? ` AND ${softCond}` : "";
    const sql = `UPDATE ${rc.tableName} SET ${assigns} WHERE ${rc.idField} IN (${placeholders})${softSql}`;
    return db.prepare(sql).bind(...values, ...chunk);
  });

  let results;
  try {
    results = await db.batch(statements);
  } catch (err) {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Bulk update failed — earlier chunks may have already committed (D1 batch is not transactional).",
      {
        resource,
        ids,
        error: err instanceof Error ? err.message : String(err),
      },
    );
  }
  const affected = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
  if (affected === 0) {
    throw new ApiError("NOT_FOUND", `No records found to update`, {
      resource,
      ids,
    });
  }
  return c.json({ data: ids });
}
