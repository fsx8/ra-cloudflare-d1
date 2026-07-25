import { describe, expect, it } from "vitest";
import { buildResource } from "../src/schema-discovery.js";

type Col = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

describe("buildResource (D1 discovery)", () => {
  it("derives idField from the pk column", () => {
    const cols: Col[] = [
      { name: "uid", type: "TEXT", notnull: 1, pk: 1 },
      { name: "title", type: "TEXT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).idField).toBe("uid");
  });

  it("falls back to 'id' when no pk column is present", () => {
    const cols: Col[] = [{ name: "uid", type: "TEXT", notnull: 1, pk: 0 }];
    expect(buildResource("notes", cols).idField).toBe("id");
  });

  it("exposes every column as selectable/filterable/sortable", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "title", type: "TEXT", notnull: 0, pk: 0 },
      { name: "views", type: "INT", notnull: 0, pk: 0 },
    ];
    const r = buildResource("posts", cols);
    expect(r.selectableFields).toEqual(["id", "title", "views"]);
    expect(r.filterableFields).toEqual(["id", "title", "views"]);
    expect(r.sortableFields).toEqual(["id", "title", "views"]);
  });

  it("only marks TEXT columns as searchable", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "title", type: "TEXT", notnull: 0, pk: 0 },
      { name: "body", type: "TEXT", notnull: 0, pk: 0 },
      { name: "views", type: "INT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).searchableFields).toEqual([
      "title",
      "body",
    ]);
  });

  it("infers boolean transforms for INT is_/has_/_flag columns", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "is_published", type: "INT", notnull: 0, pk: 0 },
      { name: "has_avatar", type: "INT", notnull: 0, pk: 0 },
      { name: "verified_flag", type: "INT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("users", cols).transforms?.booleans).toEqual([
      "is_published",
      "has_avatar",
      "verified_flag",
    ]);
  });

  it("infers date transforms for TEXT _at/_date/timestamp columns", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "created_at", type: "TEXT", notnull: 0, pk: 0 },
      { name: "publish_date", type: "TEXT", notnull: 0, pk: 0 },
      { name: "raw_timestamp", type: "TEXT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).transforms?.dates).toEqual([
      "created_at",
      "publish_date",
      "raw_timestamp",
    ]);
  });

  it("detects a deleted_at timestamp soft-delete column", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "deleted_at", type: "TEXT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).softDelete).toEqual({
      field: "deleted_at",
      type: "timestamp",
    });
  });

  it("detects a boolean 'deleted' soft-delete column", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "deleted", type: "INT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).softDelete).toEqual({
      field: "deleted",
      type: "boolean",
    });
  });

  it("omits softDelete when no soft-delete column exists", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "title", type: "TEXT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).softDelete).toBeUndefined();
  });
});
