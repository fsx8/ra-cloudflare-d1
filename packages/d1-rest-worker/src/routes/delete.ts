import type { Context } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { softDeleteCondition } from "../sql/builder.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";
import { getD1Database } from "../types.js";

export async function deleteRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  const resource = c.req.param("resource");
  const id = c.req.param("id");
  const rc = validateResource(resource, config);
  const db = getD1Database(c.env, dbBinding);

  if (rc.softDelete) {
    const field = validateIdentifier(rc.softDelete.field, "softDelete field");
    const softCond = softDeleteCondition(rc);
    const softSql = softCond ? ` AND ${softCond}` : "";
    const valueExpr =
      rc.softDelete.type === "boolean" ? "1" : "CURRENT_TIMESTAMP";
    const sql = `UPDATE ${rc.tableName} SET ${field} = ${valueExpr} WHERE ${rc.idField} = ?${softSql}`;

    const res = await db.prepare(sql).bind(id).run();
    const changes = res.meta?.changes ?? 0;
    if (changes === 0) {
      throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
    }
    return c.json({ id });
  }

  const res = await db
    .prepare(`DELETE FROM ${rc.tableName} WHERE ${rc.idField} = ?`)
    .bind(id)
    .run();
  const changes = res.meta?.changes ?? 0;
  if (changes === 0) {
    throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
  }
  return c.json({ id });
}
