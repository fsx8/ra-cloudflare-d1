import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { softDeleteCondition } from "../sql/builder.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";

export async function deleteRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const id = c.req.param("id");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  if (rc.softDelete) {
    const field = validateIdentifier(rc.softDelete.field, "softDelete field");
    const softCond = softDeleteCondition(rc);
    const softSql = softCond ? ` AND ${softCond}` : "";
    const valueExpr =
      rc.softDelete.type === "boolean" ? "1" : "CURRENT_TIMESTAMP";
    const sql = `UPDATE ${rc.tableName} SET ${field} = ${valueExpr} WHERE ${rc.idField} = ?${softSql}`;

    const res = await db.execute(sql, [id]);
    if (res.changes === 0) {
      throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
    }
    return c.json({ id });
  }

  const res = await db.execute(
    `DELETE FROM ${rc.tableName} WHERE ${rc.idField} = ?`,
    [id],
  );
  if (res.changes === 0) {
    throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
  }
  return c.json({ id });
}
