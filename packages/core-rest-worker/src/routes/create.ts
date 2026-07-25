import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { ApiError } from "../middleware/errors.js";
import { buildSelectFields } from "../sql/builder.js";
import { validateField, validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";

export async function createRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Body must be a JSON object");
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "No fields to insert");
  }

  const columns = keys.map((k) =>
    validateField(k, rc.selectableFields, "selectable", rc.idField),
  );
  const values = keys.map((k) => body[k]);
  const placeholders = columns.map(() => "?").join(", ");

  const selectFields = buildSelectFields(rc);
  const sql =
    `INSERT INTO ${rc.tableName} (${columns.join(", ")}) ` +
    `VALUES (${placeholders}) RETURNING ${selectFields}`;

  const res = await db.execute(sql, values);
  const row = res.rows[0];
  if (!row) {
    throw new ApiError("INTERNAL_ERROR", "Insert did not return a row");
  }
  return c.json(transformRecord(rc, row), 201);
}
