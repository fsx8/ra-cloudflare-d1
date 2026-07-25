import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
import type { ResourceConfig } from "rest-worker-types";

async function readTemplate(rel: string) {
  const url = new URL(`../templates/${rel}`, import.meta.url);
  return fs.readFile(url, "utf8");
}

async function writeFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateProject(input: {
  outDir: string;
  projectName: string;
  tursoUrl: string;
  tursoAuthToken: string;
  tables: string[];
  resources: Record<string, ResourceConfig>;
  apiKey: string;
}) {
  await fs.mkdir(input.outDir, { recursive: true });

  const templates = [
    "package.json.hbs",
    "tsconfig.json.hbs",
    "wrangler.jsonc.hbs",
    ".dev.vars.hbs",
    ".gitignore.hbs",
    "README.md.hbs",
    "src/index.ts.hbs",
  ];

  const ctx = {
    projectName: input.projectName,
    tursoUrl: input.tursoUrl,
    tursoAuthToken: input.tursoAuthToken,
    apiKey: input.apiKey,
    resourcesJson: JSON.stringify(input.resources, null, 2),
  };

  for (const name of templates) {
    const tpl = await readTemplate(name);
    const render = Handlebars.compile(tpl);
    const relOut =
      name === "src/index.ts.hbs"
        ? "src/index.ts"
        : name.replace(/\.hbs$/, "").replace(/^_/, "");
    await writeFile(path.join(input.outDir, relOut), render(ctx));
  }
}
