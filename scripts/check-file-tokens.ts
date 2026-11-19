// Fails when a staged file is over the token budget in CODING_STANDARDS.md
// ("Keep files under 5000 tokens"). Run by the pre-commit hook.
//
// Tokens are estimated as bytes / 4: cheap, and close enough for a budget.
//
// Usage:
//   tsx scripts/check-file-tokens.ts            # checks staged files
//   tsx scripts/check-file-tokens.ts a.ts b.ts  # checks these files on disk

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;

// Generated or vendored files nobody splits by hand.
const IGNORED = [
  /(^|\/)package-lock\.json$/,
  /^drizzle\//,
  /^\.agents\//,
  /^\.claude\//,
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|db|lock)$/,
];

export type FileSize = { path: string; bytes: number };
export type Oversized = FileSize & { tokens: number };

export function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

export function findOversizedFiles(files: FileSize[]): Oversized[] {
  return files
    .filter((file) => !IGNORED.some((pattern) => pattern.test(file.path)))
    .map((file) => ({ ...file, tokens: estimateTokens(file.bytes) }))
    .filter((file) => file.tokens > MAX_TOKENS)
    .sort((a, b) => b.tokens - a.tokens);
}

export function formatReport(oversized: Oversized[]): string {
  const list = oversized
    .map((file) => `  ${file.path}: ~${file.tokens} tokens`)
    .join("\n");

  return `✖ ${oversized.length} file(s) over the ${MAX_TOKENS}-token limit (estimated as bytes / 4):

${list}

Split each file before committing. How to split:

1. Find the seams. Look for groups of code that change together and share
   names: a component and its helpers, a loader's queries, one action
   intent, a group of related tests. Each group becomes its own file.
2. Route files (app/routes/*.tsx): keep the loader, action and default
   component in the route. Move data access and business rules into a
   module under app/modules/<name>/ (see app/modules/README.md) and move
   large sub-components into app/components/ or a sibling file.
3. Module files: move implementation into the module's private lib/ folder
   and keep the entry points (index.ts, index.server.ts) small. Do not add
   a barrel file that re-exports everything.
4. Test files: split by behaviour, one file per feature or entry point
   (e.g. tests/refunds.test.ts, tests/enrollments.test.ts). Move shared
   setup into a fixture in the same tests/ folder.
5. Move code verbatim first; do not refactor while splitting. Then run
   \`npm run check\` and fix any broken imports.

Aim for several files well under the limit rather than two files just under
it. Do not bypass this check with --no-verify.
`;
}

function stagedFiles(): FileSize[] {
  const paths = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean);

  if (paths.length === 0) return [];

  // One git process for every size; spawning one per file is slow.
  const sizes = execFileSync(
    "git",
    ["cat-file", "--batch-check=%(objectsize)"],
    { encoding: "utf8", input: paths.map((path) => `:${path}\n`).join("") }
  )
    .trim()
    .split("\n");

  return paths.map((path, index) => ({ path, bytes: Number(sizes[index]) }));
}

function filesOnDisk(paths: string[]): FileSize[] {
  return paths.map((path) => ({ path, bytes: statSync(path).size }));
}

function main(): void {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? filesOnDisk(args) : stagedFiles();
  const oversized = findOversizedFiles(files);

  if (oversized.length > 0) {
    console.error(formatReport(oversized));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
