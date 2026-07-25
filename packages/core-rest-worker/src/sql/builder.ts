import type {
  ResourceConfig,
  SimpleRestFilter,
  SimpleRestRange,
  SimpleRestSort,
} from "rest-worker-types";
import { ApiError } from "../middleware/errors.js";
import { validateField, validateIdentifier } from "./validator.js";

type WhereBuildResult = { sql: string; params: unknown[] };

const OP_SUFFIXES = [
  ["_gt", ">"],
  ["_gte", ">="],
  ["_lt", "<"],
  ["_lte", "<="],
] as const;

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

const LIKE_SUFFIXES = [
  ["_contains", (v: string) => `%${escapeLike(v)}%`],
  ["_startsWith", (v: string) => `${escapeLike(v)}%`],
  ["_endsWith", (v: string) => `%${escapeLike(v)}`],
] as const;

export function softDeleteCondition(config: ResourceConfig) {
  if (!config.softDelete) return null;
  const field = validateIdentifier(config.softDelete.field, "softDelete field");
  if (config.softDelete.type === "boolean") {
    return `COALESCE(${field}, 0) = 0`;
  }
  return `${field} IS NULL`;
}

function parseFilterKey(rawKey: string): {
  field: string;
  op: string | null;
  kind: "compare" | "like" | "eq";
} {
  for (const [suffix, op] of OP_SUFFIXES) {
    if (rawKey.endsWith(suffix))
      return { field: rawKey.slice(0, -suffix.length), op, kind: "compare" };
  }
  for (const [suffix] of LIKE_SUFFIXES) {
    if (rawKey.endsWith(suffix))
      return {
        field: rawKey.slice(0, -suffix.length),
        op: suffix,
        kind: "like",
      };
  }
  return { field: rawKey, op: null, kind: "eq" };
}

function buildFilterCondition(
  config: ResourceConfig,
  key: string,
  value: unknown,
): { sql: string; params: unknown[] } | null {
  if (key === "_includeDeleted") return null;
  if (key === "q") return null;

  const { field: rawField, op, kind } = parseFilterKey(key);
  const field = rawField === "id" ? config.idField : rawField;
  validateField(field, config.filterableFields, "filterable", config.idField);

  if (Array.isArray(value)) {
    if (kind !== "eq") {
      throw new ApiError(
        "VALIDATION_ERROR",
        `Operator suffix '${op}' is not supported with array values`,
        {
          field,
          key,
        },
      );
    }
    if (value.length === 0) return { sql: "1 = 0", params: [] };
    const placeholders = value.map(() => "?").join(",");
    return { sql: `${field} IN (${placeholders})`, params: value };
  }

  if (value === null) return { sql: `${field} IS NULL`, params: [] };
  if (value === undefined) return null;

  if (kind === "compare") return { sql: `${field} ${op} ?`, params: [value] };
  if (kind === "like") {
    if (typeof value !== "string") {
      throw new ApiError(
        "VALIDATION_ERROR",
        `LIKE filter requires string value`,
        { field, key },
      );
    }
    const like = LIKE_SUFFIXES.find(([suffix]) => suffix === op);
    if (!like) return { sql: `${field} = ?`, params: [value] };
    const [, mapper] = like;
    return { sql: `${field} LIKE ? ESCAPE '\\'`, params: [mapper(value)] };
  }
  return { sql: `${field} = ?`, params: [value] };
}

function buildQSearch(
  config: ResourceConfig,
  q: unknown,
): { sql: string; params: unknown[] } | null {
  if (!q) return null;
  if (typeof q !== "string") {
    throw new ApiError("VALIDATION_ERROR", "filter.q must be a string");
  }
  const fields = config.searchableFields ?? [];
  if (fields.length === 0) return null;
  const validated = fields.map((f) =>
    validateField(f, config.searchableFields, "searchable"),
  );
  const clauses = validated.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(" OR ");
  const params = validated.map(() => `%${escapeLike(q)}%`);
  return { sql: `(${clauses})`, params };
}

export function buildWhereClause(
  config: ResourceConfig,
  filter: SimpleRestFilter,
): WhereBuildResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const includeDeleted = Boolean(filter?._includeDeleted);
  if (config.softDelete && !includeDeleted) {
    const cond = softDeleteCondition(config);
    if (cond) conditions.push(cond);
  }

  const q = filter?.q;
  const qSearch = buildQSearch(config, q);
  if (qSearch) {
    conditions.push(qSearch.sql);
    params.push(...qSearch.params);
  }

  for (const [key, value] of Object.entries(filter ?? {})) {
    const built = buildFilterCondition(config, key, value);
    if (!built) continue;
    conditions.push(built.sql);
    params.push(...built.params);
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function buildOrderByClause(
  config: ResourceConfig,
  sort: SimpleRestSort,
): string {
  const [field, order] = sort;
  const validatedField = field === "id" ? config.idField : field;
  validateField(
    validatedField,
    config.sortableFields,
    "sortable",
    config.idField,
  );
  const dir = order === "DESC" ? "DESC" : "ASC";
  return `ORDER BY ${validatedField} ${dir}`;
}

export function buildLimitOffset(
  range: SimpleRestRange,
  maxPerPage = 1000,
): { limit: number; offset: number } {
  const [start, end] = range;
  const safeStart = Number.isFinite(start) ? Math.max(0, Math.floor(start)) : 0;
  const safeEnd = Number.isFinite(end)
    ? Math.max(safeStart, Math.floor(end))
    : safeStart + 24;
  const limit = Math.min(safeEnd - safeStart + 1, maxPerPage);
  return { limit, offset: safeStart };
}

export function buildSelectFields(config: ResourceConfig): string {
  const idField = validateIdentifier(config.idField, "id field");
  const unique = Array.from(new Set(config.selectableFields));
  const columns = unique
    .filter((f) => f !== idField)
    .map((f) => validateField(f, config.selectableFields, "selectable"));

  return [`${idField} as id`, ...columns].join(", ");
}
