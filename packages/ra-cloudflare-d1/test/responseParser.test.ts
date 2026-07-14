import { describe, expect, it } from "vitest";
import { parseTotal } from "../src/responseParser";

describe("responseParser.parseTotal", () => {
  it("parses total from Content-Range", () => {
    const headers = new Headers({ "Content-Range": "posts 0-9/123" });
    expect(parseTotal(headers)).toBe(123);
  });

  it("falls back to X-Total-Count", () => {
    const headers = new Headers({ "X-Total-Count": "42" });
    expect(parseTotal(headers)).toBe(42);
  });

  it("returns 0 on missing/invalid headers", () => {
    expect(parseTotal(new Headers())).toBe(0);
    expect(parseTotal(new Headers({ "Content-Range": "oops" }))).toBe(0);
  });
});
