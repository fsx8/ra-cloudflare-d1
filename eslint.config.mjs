// Flat ESLint config. See AGENTS.md for toolchain notes.
//
// Type-checked mode (recommendedTypeChecked) requires each linted file to
// belong to a tsconfig project. No package has a plain tsconfig.json (each
// uses tsconfig.build.json and/or tsconfig.typecheck.json), so we list them
// explicitly; typescript-eslint matches each file to the right one via its
// `include` globs.
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.wrangler/**",
      // CLI scaffolders emit these from handlebars templates — not linted.
      "packages/create-d1-rest-worker/templates/**",
      "packages/create-turso-rest-worker/templates/**",
      // Templates and examples are validation scaffolds / CLI output; not linted.
      "templates/**",
      "examples/**",
    ],
  },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: [
          "packages/shared-types/tsconfig.build.json",
          "packages/core-rest-worker/tsconfig.typecheck.json",
          "packages/d1-rest-worker/tsconfig.typecheck.json",
          "packages/turso-rest-worker/tsconfig.typecheck.json",
          "packages/ra-cloudflare-d1/tsconfig.typecheck.json",
          "packages/ra-turso/tsconfig.typecheck.json",
          "packages/create-d1-rest-worker/tsconfig.typecheck.json",
          "packages/create-turso-rest-worker/tsconfig.typecheck.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    // The CLI packages legitimately write to stdout/stderr.
    files: [
      "packages/create-d1-rest-worker/src/**/*.ts",
      "packages/create-turso-rest-worker/src/**/*.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
);
