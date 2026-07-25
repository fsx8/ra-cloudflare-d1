import { describe, expect, it } from "vitest";
import { createD1DataProvider } from "ra-cloudflare-d1";
import { createTursoDataProvider } from "../src/index.js";

describe("ra-turso re-export", () => {
  it("aliases createD1DataProvider as createTursoDataProvider (same function)", () => {
    expect(createTursoDataProvider).toBe(createD1DataProvider);
  });

  it("exposes the provider as a function", () => {
    expect(typeof createTursoDataProvider).toBe("function");
  });

  it("returns a data provider with the expected DataProvider methods", () => {
    const provider = createTursoDataProvider({
      apiUrl: "https://example.test/api",
      apiKey: "sk_test",
    });
    for (const method of [
      "getList",
      "getOne",
      "getMany",
      "getManyReference",
      "create",
      "update",
      "updateMany",
      "delete",
      "deleteMany",
    ] as const) {
      expect(typeof provider[method]).toBe("function");
    }
  });
});
