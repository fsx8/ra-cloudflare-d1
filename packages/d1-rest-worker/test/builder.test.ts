import { describe, expect, it } from "vitest";
import {
  buildLimitOffset,
  buildOrderByClause,
  buildSelectFields,
  buildWhereClause,
} from "../src/sql/builder";
import type { ResourceConfig } from "@ra-cloudflare-d1/types";

function makeResourceConfig(
  overrides: Partial<ResourceConfig> = {},
): ResourceConfig {
  return {
    tableName: "posts",
    idField: "id",
    selectableFields: ["id", "title", "body", "deleted_at", "age"],
    sortableFields: ["id", "title"],
    filterableFields: ["id", "title", "age"],
    searchableFields: ["title", "body"],
    ...overrides,
  };
}

describe("sql/builder", () => {
  it("buildLimitOffset uses inclusive range", () => {
    expect(buildLimitOffset([0, 24])).toEqual({ limit: 25, offset: 0 });
    expect(buildLimitOffset([10, 10])).toEqual({ limit: 1, offset: 10 });
  });

  it("buildSelectFields maps configured idField to `id`", () => {
    const rc = makeResourceConfig({
      idField: "post_id",
      selectableFields: ["post_id", "title", "post_id"],
    });
    expect(buildSelectFields(rc)).toBe("post_id as id, title");
  });

  it("buildOrderByClause supports sorting by `id` alias", () => {
    const rc = makeResourceConfig({
      idField: "post_id",
      sortableFields: ["post_id", "title"],
    });
    expect(buildOrderByClause(rc, ["id", "DESC"])).toBe(
      "ORDER BY post_id DESC",
    );
  });

  it("treats idField as always selectable/sortable/filterable even when absent from the arrays", () => {
    const rc = makeResourceConfig({
      idField: "post_id",
      selectableFields: ["title"],
      sortableFields: ["title"],
      filterableFields: ["title"],
    });

    expect(buildSelectFields(rc)).toBe("post_id as id, title");
    expect(buildOrderByClause(rc, ["id", "ASC"])).toBe("ORDER BY post_id ASC");
    expect(buildOrderByClause(rc, ["post_id", "ASC"])).toBe(
      "ORDER BY post_id ASC",
    );
    // filtering by id (getMany) must work without listing idField
    const where = buildWhereClause(rc, { id: ["a", "b"] });
    expect(where.sql).toBe("WHERE post_id IN (?,?)");
    expect(where.params).toEqual(["a", "b"]);
  });

  it("buildWhereClause applies soft-delete filter unless explicitly included", () => {
    const rc = makeResourceConfig({
      softDelete: { field: "deleted_at", type: "timestamp" },
      selectableFields: ["id", "title"], // soft-delete field does not need to be selectable
    });

    expect(buildWhereClause(rc, {}).sql).toBe("WHERE deleted_at IS NULL");
    expect(buildWhereClause(rc, { _includeDeleted: true }).sql).toBe("");
  });

  it("buildWhereClause supports operator suffixes and q-search", () => {
    const rc = makeResourceConfig({
      softDelete: { field: "deleted_at", type: "timestamp" },
      searchableFields: ["title", "body"],
      filterableFields: ["id", "title", "age", "deleted_at"],
    });

    const where = buildWhereClause(rc, {
      q: "hello",
      age_gt: 18,
      title_contains: "world",
      id: [1, 2, 3],
    });

    expect(where.sql).toBe(
      "WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') AND age > ? AND title LIKE ? ESCAPE '\\' AND id IN (?,?,?)",
    );
    expect(where.params).toEqual([
      "%hello%",
      "%hello%",
      18,
      "%world%",
      1,
      2,
      3,
    ]);
  });
});
