import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateProject } from "../src/generator.js";
import type { ResourceConfig } from "@ra-cloudflare-d1/types";

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

describe("generateProject", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "d1-gen-"));
  });

  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("writes files without .hbs extension", async () => {
    await generateProject({
      outDir,
      projectName: "test-worker",
      accountId: "acc",
      databaseId: "db",
      tables: ["posts"],
      resources: sampleResources,
      apiKey: "sk_test",
    });

    const entries = await fs.readdir(outDir, { recursive: true });
    const hbsFiles = entries.filter((e) => e.endsWith(".hbs"));
    expect(hbsFiles).toEqual([]);
  });

  it("generates a valid package.json", async () => {
    await generateProject({
      outDir,
      projectName: "test-worker",
      accountId: "acc",
      databaseId: "db",
      tables: ["posts"],
      resources: sampleResources,
      apiKey: "sk_test",
    });

    const pkgPath = path.join(outDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("test-worker");
    expect(pkg.dependencies["d1-rest-worker"]).toBeDefined();
  });

  it("generates src/index.ts with unescaped (valid JS) resources object", async () => {
    await generateProject({
      outDir,
      projectName: "test-worker",
      accountId: "acc",
      databaseId: "db",
      tables: ["posts"],
      resources: sampleResources,
      apiKey: "sk_test",
    });

    const src = await fs.readFile(path.join(outDir, "src", "index.ts"), "utf8");

    // Should NOT contain HTML-escaped quotes
    expect(src).not.toContain("&quot;");

    // Should contain the resources object with proper JS syntax
    expect(src).toContain('"posts"');
    expect(src).toContain('"tableName": "posts"');
  });

  it("generates wrangler.jsonc and .dev.vars without .hbs suffix", async () => {
    await generateProject({
      outDir,
      projectName: "test-worker",
      accountId: "acc",
      databaseId: "db",
      tables: ["posts"],
      resources: sampleResources,
      apiKey: "sk_test",
    });

    await fs.access(path.join(outDir, "wrangler.jsonc"));
    await fs.access(path.join(outDir, ".dev.vars"));
    await fs.access(path.join(outDir, ".gitignore"));
    await fs.access(path.join(outDir, "tsconfig.json"));
    await fs.access(path.join(outDir, "README.md"));
  });
});
