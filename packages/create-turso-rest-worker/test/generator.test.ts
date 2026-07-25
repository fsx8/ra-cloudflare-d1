import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateProject } from "../src/generator.js";
import type { ResourceConfig } from "rest-worker-types";

const sampleResources: Record<string, ResourceConfig> = {
  posts: {
    tableName: "posts",
    idField: "id",
    selectableFields: ["id", "title", "body"],
    filterableFields: ["id", "title"],
    sortableFields: ["id", "title"],
    searchableFields: ["title", "body"],
  },
};

const baseInput = {
  projectName: "test-worker",
  tursoUrl: "libsql://test.turso.io",
  tursoAuthToken: "token",
  tables: ["posts"],
  resources: sampleResources,
  apiKey: "sk_test",
};

describe("generateProject", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "turso-gen-"));
  });

  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("writes files without .hbs extension", async () => {
    await generateProject({ outDir, ...baseInput });

    const entries = await fs.readdir(outDir, { recursive: true });
    const hbsFiles = entries.filter((e) => e.endsWith(".hbs"));
    expect(hbsFiles).toEqual([]);
  });

  it("generates a valid package.json", async () => {
    await generateProject({ outDir, ...baseInput });

    const pkgPath = path.join(outDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("test-worker");
    expect(pkg.dependencies["turso-rest-worker"]).toBeDefined();
  });

  it("generates src/index.ts with unescaped (valid JS) resources object", async () => {
    await generateProject({ outDir, ...baseInput });

    const src = await fs.readFile(path.join(outDir, "src", "index.ts"), "utf8");

    // Should NOT contain HTML-escaped quotes
    expect(src).not.toContain("&quot;");

    // Should contain the resources object with proper JS syntax
    expect(src).toContain('"posts"');
    expect(src).toContain('"tableName": "posts"');
  });

  it("writes Turso URL into wrangler.jsonc and token into .dev.vars", async () => {
    await generateProject({ outDir, ...baseInput });

    const wrangler = await fs.readFile(
      path.join(outDir, "wrangler.jsonc"),
      "utf8",
    );
    expect(wrangler).toContain("TURSO_CONNECTION_URL");
    expect(wrangler).toContain("libsql://test.turso.io");
    // The auth token is a secret — it must NOT leak into wrangler.jsonc.
    expect(wrangler).not.toContain("token");

    const devVars = await fs.readFile(path.join(outDir, ".dev.vars"), "utf8");
    expect(devVars).toContain("API_KEY=sk_test");
    expect(devVars).toContain("TURSO_AUTH_TOKEN=token");
  });

  it("generates wrangler.jsonc and .dev.vars without .hbs suffix", async () => {
    await generateProject({ outDir, ...baseInput });

    await fs.access(path.join(outDir, "wrangler.jsonc"));
    await fs.access(path.join(outDir, ".dev.vars"));
    await fs.access(path.join(outDir, ".gitignore"));
    await fs.access(path.join(outDir, "tsconfig.json"));
    await fs.access(path.join(outDir, "README.md"));
  });
});
