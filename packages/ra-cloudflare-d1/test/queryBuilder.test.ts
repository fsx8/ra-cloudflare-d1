import { describe, expect, it } from "vitest";
import { buildListQuery } from "../src/queryBuilder";

describe("queryBuilder.buildListQuery", () => {
  it("serializes sort/range/filter as JSON strings", () => {
    const qs = buildListQuery({
      sort: ["created_at", "DESC"],
      range: [0, 24],
      filter: { status: "active", id: [1, 2] },
    });
    const sp = new URLSearchParams(qs);
    expect(sp.get("sort")).toBe(JSON.stringify(["created_at", "DESC"]));
    expect(sp.get("range")).toBe(JSON.stringify([0, 24]));
    expect(sp.get("filter")).toBe(
      JSON.stringify({ status: "active", id: [1, 2] }),
    );
  });
});
