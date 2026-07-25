import { describe, expect, it } from "vitest";
import { buildResource } from "../src/turso-schema.js";

type Col = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

describe("buildResource (Turso discovery)", () => {
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
      { name: "views", type: "INT", notnull: 0, pk: 0 },
    ];
    expect(buildResource("posts", cols).searchableFields).toEqual(["title"]);
  });

  it("infers boolean and date transforms together", () => {
    const cols: Col[] = [
      { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
      { name: "is_published", type: "INT", notnull: 0, pk: 0 },
      { name: "created_at", type: "TEXT", notnull: 0, pk: 0 },
    ];
    const r = buildResource("posts", cols);
    expect(r.transforms?.booleans).toEqual(["is_published"]);
    expect(r.transforms?.dates).toEqual(["created_at"]);
  });

  it("detects timestamp and boolean soft-delete columns", () => {
    expect(
      buildResource("a", [
        { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
        { name: "deleted_at", type: "TEXT", notnull: 0, pk: 0 },
      ]).softDelete,
    ).toEqual({ field: "deleted_at", type: "timestamp" });

    expect(
      buildResource("b", [
        { name: "id", type: "INTEGER", notnull: 1, pk: 1 },
        { name: "deleted", type: "INT", notnull: 0, pk: 0 },
      ]).softDelete,
    ).toEqual({ field: "deleted", type: "boolean" });

    expect(
      buildResource("c", [{ name: "id", type: "INTEGER", notnull: 1, pk: 1 }])
        .softDelete,
    ).toBeUndefined();
  });
});
