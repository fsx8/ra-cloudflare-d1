import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { buildSelectFields, softDeleteCondition } from "../sql/builder.js";
import { validateField, validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";

export async function updateRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const id = c.req.param("id");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Body must be a JSON object");
  }

  const keys = Object.keys(body).filter((k) => k !== rc.idField);
  if (keys.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "No fields to update");
  }

  const columns = keys.map((k) =>
    validateField(k, rc.selectableFields, "selectable"),
  );
  const assigns = columns.map((col) => `${col} = ?`).join(", ");
  const values = keys.map((k) => body[k]);

  const selectFields = buildSelectFields(rc);
  const softCond = softDeleteCondition(rc);
  const softSql = softCond ? ` AND ${softCond}` : "";
  const sql = `UPDATE ${rc.tableName} SET ${assigns} WHERE ${rc.idField} = ?${softSql} RETURNING ${selectFields}`;

  const res = await db.execute(sql, [...values, id]);
  const row = res.rows[0];
  if (!row) {
    throw new ApiError("NOT_FOUND", `Record not found`, { resource, id });
  }
  return c.json(transformRecord(rc, row));
}
