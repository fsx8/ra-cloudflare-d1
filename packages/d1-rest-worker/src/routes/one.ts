import type { Context } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { buildSelectFields } from "../sql/builder.js";
import { validateIdentifier, validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";
import { getD1Database } from "../types.js";

export async function oneRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  const resource = c.req.param("resource");
  const id = c.req.param("id");
  const rc = validateResource(resource, config);
  const db = getD1Database(c.env, dbBinding);

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
  const stmt = db
    .prepare(
      `SELECT ${selectFields} FROM ${rc.tableName} WHERE ${rc.idField} = ?${softCond} LIMIT 1`,
    )
    .bind(id);
  const res = await stmt.all();
  const row = res.results?.[0];
  if (!row) {
    throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
  }
  return c.json(transformRecord(rc, row));
}
