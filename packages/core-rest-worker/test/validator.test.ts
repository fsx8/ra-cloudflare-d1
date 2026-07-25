import { describe, expect, it } from "vitest";
import {
  validateField,
  validateIdentifier,
  validateResource,
} from "../src/sql/validator.js";
import { ApiError } from "../src/middleware/errors.js";
import type { RestWorkerConfig } from "rest-worker-types";

const config: RestWorkerConfig = {
  apiKey: "k",
  corsOrigins: "*",
  resources: {
    posts: {
      tableName: "posts",
      idField: "id",
      selectableFields: ["id", "title"],
      filterableFields: ["id"],
      sortableFields: ["id"],
      searchableFields: ["title"],
    },
  },
};

describe("validateIdentifier", () => {
  it("accepts valid SQL identifiers", () => {
    expect(validateIdentifier("posts", "table")).toBe("posts");
    expect(validateIdentifier("_user_1", "table")).toBe("_user_1");
  });

  it("rejects anything outside [A-Za-z_][A-Za-z0-9_]*", () => {
    for (const bad of [
      "",
      "1abc",
      "drop table",
      "x; --",
      "weird-name",
      "a b",
    ]) {
      expect(() => validateIdentifier(bad, "table")).toThrow(ApiError);
    }
  });
});

describe("validateResource", () => {
  it("returns the resource config for allow-listed resources", () => {
    expect(validateResource("posts", config).tableName).toBe("posts");
  });

  it("throws VALIDATION_ERROR when no resource is given", () => {
    try {
      validateResource(undefined, config);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws FORBIDDEN for resources not in the allow-list", () => {
    try {
      validateResource("secrets", config);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("rejects a resource whose tableName is not a valid identifier", () => {
    const bad: RestWorkerConfig = {
      apiKey: "k",
      corsOrigins: "*",
      resources: {
        bad: {
          tableName: "drop table",
          idField: "id",
          selectableFields: ["id"],
          filterableFields: ["id"],
          sortableFields: ["id"],
          searchableFields: [],
        },
      },
    };
    expect(() => validateResource("bad", bad)).toThrow(ApiError);
  });
});

describe("validateField", () => {
  it("accepts fields present in the allow-list", () => {
    expect(validateField("id", ["id", "title"], "selectable")).toBe("id");
    expect(validateField("title", ["id", "title"], "selectable")).toBe("title");
  });

  it("accepts the alwaysAllowed field even when not in the allow-list", () => {
    expect(validateField("id", ["title"], "selectable", "id")).toBe("id");
  });

  it("rejects fields that are neither allowed nor alwaysAllowed", () => {
    try {
      validateField("secret", ["id", "title"], "selectable");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects an allow-listed field that is not a valid identifier", () => {
    expect(() => validateField("bad name", ["bad name"], "selectable")).toThrow(
      ApiError,
    );
  });
});
