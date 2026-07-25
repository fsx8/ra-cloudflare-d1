import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { buildSelectFields } from "../sql/builder.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";

export async function oneRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const id = c.req.param("id");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  const selectFields = buildSelectFields(rc);
  const includeDeleted = ["1", "true"].includes(
    (c.req.query("includeDeleted") ?? "").toLowerCase(),
  );
  const softField = rc.softDelete
    ? validateIdentifier(rc.softDelete.field, "softDelete field")
    : null;
  const softCond =
    rc.softDelete && softField && !includeDeleted
      ? rc.softDelete.type === "boolean"
        ? ` AND COALESCE(${softField}, 0) = 0`
        : ` AND ${softField} IS NULL`
      : "";
  const sql = `SELECT ${selectFields} FROM ${rc.tableName} WHERE ${rc.idField} = ?${softCond} LIMIT 1`;
  const res = await db.execute(sql, [id]);
  const row = res.rows[0];
  if (!row) {
    throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
  }
  return c.json(transformRecord(rc, row));
}
