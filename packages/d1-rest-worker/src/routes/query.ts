import type {
  ParsedListQuery,
  SimpleRestFilter,
  SimpleRestRange,
  SimpleRestSort,
} from "@ra-cloudflare-d1/types";
import { ApiError } from "../middleware/errors.js";

function parseJsonParam<T>(
  raw: string | undefined | null,
  label: string,
): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError("VALIDATION_ERROR", `Invalid JSON for '${label}'`, {
      label,
      raw,
    });
  }
}

export function parseListQuery(
  query: Record<string, string | undefined>,
): ParsedListQuery {
  const sort = parseJsonParam<SimpleRestSort>(query.sort, "sort") ?? [
    "id",
    "ASC",
  ];
  const range = parseJsonParam<SimpleRestRange>(query.range, "range") ?? [
    0, 24,
  ];
  const filter = parseJsonParam<SimpleRestFilter>(query.filter, "filter") ?? {};

  if (!Array.isArray(sort) || sort.length !== 2) {
    throw new ApiError("VALIDATION_ERROR", "Invalid 'sort' value");
  }
  if (!Array.isArray(range) || range.length !== 2) {
    throw new ApiError("VALIDATION_ERROR", "Invalid 'range' value");
  }
  if (filter === null || typeof filter !== "object" || Array.isArray(filter)) {
    throw new ApiError("VALIDATION_ERROR", "Invalid 'filter' value");
  }
  return { sort, range, filter };
}
