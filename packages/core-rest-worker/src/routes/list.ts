import type { Context } from "hono";
import type { RestWorkerConfig } from "rest-worker-types";
import type { RestAppEnv } from "../db.js";
import { parseListQuery } from "./query.js";
import {
  buildLimitOffset,
  buildOrderByClause,
  buildSelectFields,
  buildWhereClause,
} from "../sql/builder.js";
import { validateResource } from "../sql/validator.js";
import { transformRecord } from "./transforms.js";

export async function listRoute(
  c: Context<RestAppEnv>,
  config: RestWorkerConfig,
) {
  const resource = c.req.param("resource");
  const rc = validateResource(resource, config);
  const db = c.get("db");

  const q = parseListQuery(c.req.query());
  const includeDeletedQuery = ["1", "true"].includes(
    (c.req.query("includeDeleted") ?? "").toLowerCase(),
  );
  const filter = includeDeletedQuery
    ? { ...q.filter, _includeDeleted: true }
    : q.filter;
  const { limit, offset } = buildLimitOffset(q.range, config.maxPerPage);
  const where = buildWhereClause(rc, filter);
  const orderBy = buildOrderByClause(rc, q.sort);
  const selectFields = buildSelectFields(rc);

  const sqlParts = [
    `SELECT ${selectFields}`,
    `FROM ${rc.tableName}`,
    where.sql,
    orderBy,
    `LIMIT ? OFFSET ?`,
  ].filter(Boolean);
  const sql = sqlParts.join(" ");

  const countSql = [
    `SELECT COUNT(*) as total`,
    `FROM ${rc.tableName}`,
    where.sql,
  ]
    .filter(Boolean)
    .join(" ");

  const [dataRes, countRes] = await db.executeMany([
    { sql, params: [...where.params, limit, offset] },
    { sql: countSql, params: where.params },
  ]);

  const rows = dataRes.rows;
  const countRow = countRes.rows[0];
  const total = Number(countRow?.total ?? 0);

  const start = offset;
  const end = offset + rows.length - 1;
  c.header(
    "Content-Range",
    `${resource} ${start}-${Math.max(start, end)}/${total}`,
  );
  c.header("X-Total-Count", String(total));

  return c.json(rows.map((r) => transformRecord(rc, r)));
}
