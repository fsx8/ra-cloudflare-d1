import { Command } from "commander";
import path from "node:path";
import { promptUser } from "./prompts.js";
import { discoverSchema } from "./turso-schema.js";
import { generateProject } from "./generator.js";
import { generateApiKey } from "./generator/apiKey.js";
import type { ResourceConfig } from "rest-worker-types";

export async function runCli(argv: string[]) {
  const program = new Command();

  program
    .name("create-turso-rest-worker")
    .description(
      "Scaffold a Cloudflare Worker REST API for Turso/libSQL (React-Admin Simple REST compatible)",
    )
    .option("-d, --dir <path>", "Output directory", "turso-rest-worker")
    .option(
      "--auto-discover",
      "Auto-discover tables by querying Turso over libSQL",
      false,
    );

  program.parse(argv);
  const opts = program.opts<{ dir: string; autoDiscover: boolean }>();

  const answers = await promptUser({ autoDiscover: opts.autoDiscover });
  const apiKey = answers.apiKey ?? generateApiKey();

  const schema = answers.autoDiscover
    ? await discoverSchema(answers.turso)
    : {
        tables: answers.tables.map((t) => ({ name: t })),
        resources: Object.fromEntries(
          answers.tables.map((t) => [
            t,
            {
              tableName: t,
              idField: "id",
              selectableFields: ["id"],
              filterableFields: ["id"],
              sortableFields: ["id"],
              searchableFields: [],
            } satisfies ResourceConfig,
          ]),
        ) as Record<string, ResourceConfig>,
      };

  const outDir = path.resolve(process.cwd(), opts.dir);
  await generateProject({
    outDir,
    projectName: path.basename(outDir),
    tursoUrl: answers.turso.tursoUrl,
    tursoAuthToken: answers.turso.tursoAuthToken,
    tables: schema.tables.map((t) => t.name),
    resources: schema.resources,
    apiKey,
  });

  console.log(`\n✅ Created ${opts.dir}/`);
  console.log(
    `✅ API Key: ${apiKey} (saved to ${path.join(opts.dir, ".dev.vars")} for local dev)`,
  );

  if (!answers.autoDiscover) {
    console.log(
      "\nNote: The generated resource config only includes the 'id' field per table.\n" +
        "      To auto-detect all columns, filters, and search fields, re-run with --auto-discover.\n" +
        "      Otherwise, edit src/index.ts to add your columns to selectableFields,\n" +
        "      filterableFields, sortableFields, and searchableFields.",
    );
  }

  console.log("\nNext steps:");
  console.log(`  cd ${opts.dir}`);
  console.log("  pnpm install");
  console.log("  pnpm exec wrangler secret put API_KEY");
  console.log("  pnpm exec wrangler secret put TURSO_AUTH_TOKEN");
  console.log("  pnpm run deploy\n");
}
