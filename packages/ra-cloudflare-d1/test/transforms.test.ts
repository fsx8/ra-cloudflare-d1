import { describe, expect, it } from "vitest";
import { applyTransforms } from "../src/transforms";

describe("transforms.applyTransforms", () => {
  it("applies boolean/date/json transforms per resource", () => {
    const out = applyTransforms(
      "posts",
      {
        is_featured: 1,
        created_at: "2026-01-19T12:00:00Z",
        metadata: '{"a":1}',
      },
      {
        booleanFields: { posts: ["is_featured"] },
        dateFields: { posts: ["created_at"] },
        jsonFields: { posts: ["metadata"] },
      },
    ) as Record<string, unknown>;

    expect(out.is_featured).toBe(true);
    expect(out.created_at).toBe("2026-01-19T12:00:00.000Z");
    expect(out.metadata).toEqual({ a: 1 });
  });
});
