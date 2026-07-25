import inquirer from "inquirer";

export interface TursoAnswers {
  tursoUrl: string;
  tursoAuthToken: string;
}

export interface PromptAnswers {
  autoDiscover: boolean;
  turso: TursoAnswers;
  tables: string[];
  apiKey?: string;
}

export async function promptUser(opts: {
  autoDiscover: boolean;
}): Promise<PromptAnswers> {
  const envUrl = process.env.TURSO_CONNECTION_URL;
  const envToken = process.env.TURSO_AUTH_TOKEN;
  const autoDiscover = opts.autoDiscover;

  const answers: PromptAnswers = {
    autoDiscover,
    tables: [],
    turso: { tursoUrl: "", tursoAuthToken: "" },
  };

  const { tursoUrl, tursoAuthToken } = await inquirer.prompt<TursoAnswers>([
    {
      type: "input",
      name: "tursoUrl",
      message: "What is your Turso connection URL? (libsql://...)",
      default: envUrl,
      validate: (v) =>
        String(v).trim() ? true : "Please enter a Turso connection URL",
    },
    {
      type: "password",
      name: "tursoAuthToken",
      message: "Turso auth token",
      mask: "*",
      default: envToken,
    },
  ]);
  answers.turso = {
    tursoUrl: tursoUrl.trim(),
    tursoAuthToken: tursoAuthToken.trim(),
  };

  if (!autoDiscover) {
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
