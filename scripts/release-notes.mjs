#!/usr/bin/env node
// Build a GitHub Release tag + body for a changesets monorepo release.
//
//   node scripts/release-notes.mjs tag     -> prints the release tag, e.g. v1.0.0
//   node scripts/release-notes.mjs body    -> prints the release notes markdown
//
// The body aggregates the latest "Major Changes" / "Minor Changes" sections from
// each package's CHANGELOG.md (deduped, since a coordinated release shares one
// changeset), and appends the list of packages published to npm. "Patch Changes"
// (usually just internal dependency bumps) are intentionally omitted.
import fs from "node:fs";
import path from "node:path";

const PACKAGES_DIR = "packages";

function readPackages() {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) =>
      fs.existsSync(path.join(PACKAGES_DIR, name, "package.json")),
    )
    .map((name) => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(PACKAGES_DIR, name, "package.json"), "utf8"),
      );
      const changelogPath = path.join(PACKAGES_DIR, name, "CHANGELOG.md");
      const changelog = fs.existsSync(changelogPath)
        ? fs.readFileSync(changelogPath, "utf8")
        : "";
      return { name: pkg.name, version: pkg.version, changelog };
    });
}

function latestVersionBlock(changelog) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((l) => /^## \d+\.\d+\.\d+/.test(l));
  if (start === -1) return "";
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

function extractSection(block, heading) {
  const m = block.match(new RegExp(`^### ${heading}\\s*$`, "m"));
  if (!m) return "";
  const rest = block.slice(m.index + m[0].length);
  const next = rest.match(/\n### /);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function dedupe(blocks) {
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    if (b && !seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
}

function buildBody(pkgs) {
  const withBlocks = pkgs.map((p) => ({
    name: p.name,
    version: p.version,
    block: latestVersionBlock(p.changelog),
  }));

  const major = dedupe(
    withBlocks.map((p) => extractSection(p.block, "Major Changes")),
  );
  const minor = dedupe(
    withBlocks.map((p) => extractSection(p.block, "Minor Changes")),
  );

  const parts = [];
  if (major.length) parts.push("## Major Changes\n\n" + major.join("\n\n"));
  if (minor.length) parts.push("## Minor Changes\n\n" + minor.join("\n\n"));

  const list = withBlocks
    .map(
      (p) =>
        `- [${p.name}@${p.version}](https://www.npmjs.com/package/${p.name})`,
    )
    .join("\n");
  parts.push("---\n\n### Published to npm\n\n" + list);
  return parts.join("\n\n") + "\n";
}

function resolveTag(pkgs) {
  const versions = [...new Set(pkgs.map((p) => p.version))];
  // Packages are released in lockstep (uniform version); fall back to the
  // greatest version if a future release ever diverges.
  const v = versions.sort().at(-1);
  return `v${v}`;
}

const pkgs = readPackages();
if (process.argv[2] === "tag") {
  process.stdout.write(resolveTag(pkgs));
} else {
  process.stdout.write(buildBody(pkgs));
}
