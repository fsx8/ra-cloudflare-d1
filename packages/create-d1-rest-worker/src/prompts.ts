import inquirer from "inquirer";

export interface CloudflareAnswers {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export interface PromptAnswers {
  autoDiscover: boolean;
  cloudflare?: CloudflareAnswers;
  databaseId: string;
  tables: string[];
  apiKey?: string;
}

export async function promptUser(opts: {
  autoDiscover: boolean;
}): Promise<PromptAnswers> {
  const envToken = process.env.CLOUDFLARE_API_TOKEN;
  const autoDiscover = opts.autoDiscover;

  const answers: PromptAnswers = { autoDiscover, tables: [], databaseId: "" };

  const { databaseId } = await inquirer.prompt<{ databaseId: string }>([
    {
      type: "input",
      name: "databaseId",
      message: "What is your D1 database ID?",
      validate: (v) =>
        String(v).trim() ? true : "Please enter a D1 database ID",
    },
  ]);
  answers.databaseId = databaseId.trim();

  if (autoDiscover) {
    const { accountId, apiToken } = await inquirer.prompt<
      Omit<CloudflareAnswers, "databaseId">
    >([
      {
        type: "input",
        name: "accountId",
        message: "What is your Cloudflare account ID?",
      },
      {
        type: "password",
        name: "apiToken",
        message: "Cloudflare API token (needs D1 read access)",
        mask: "*",
        default: envToken,
      },
    ]);
    answers.cloudflare = {
      accountId: accountId.trim(),
      databaseId: answers.databaseId,
      apiToken,
    };
  } else {
    const { tables } = await inquirer.prompt<{ tables: string }>([
      {
        type: "input",
        name: "tables",
        message: "Enter your database tables (comma-separated)",
        validate: (v) =>
          String(v).trim() ? true : "Please enter at least one table",
      },
    ]);
    answers.tables = tables
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const { generateKey } = await inquirer.prompt<{ generateKey: boolean }>([
    {
      type: "confirm",
      name: "generateKey",
      message: "Generate API key?",
      default: true,
    },
  ]);
  if (!generateKey) {
    const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
      {
        type: "input",
        name: "apiKey",
        message: "Enter API key (will be used as Bearer token)",
      },
    ]);
    answers.apiKey = apiKey;
  }

  return answers;
}
