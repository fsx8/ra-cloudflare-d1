import type { Context } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";
import { buildSelectFields } from "../sql/builder.js";
import { validateField, validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";
import { getD1Database } from "../types.js";

export async function createRoute(
  c: Context,
  config: D1RestConfig,
  dbBinding: string,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = getD1Database(c.env, dbBinding);

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

  const res = await db
    .prepare(sql)
    .bind(...values)
    .all();
  const row = res.results?.[0];
  if (!row) {
    throw new ApiError("INTERNAL_ERROR", "Insert did not return a row");
  }
  return c.json(transformRecord(rc, row), 201);
}
