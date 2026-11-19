// Fails when a change adds files to the oxlint size exemptions.
// Usage: node scripts/check-lint-exemptions.js [.oxlintrc.json]
//
// The size rules (max-lines, max-depth, ...) are switched off for files that
// were already too big when the rules arrived. The list may shrink as those
// files are split. It may not grow: moving a long function into a new file
// and exempting the new file is the same debt with more entries. Swapping
// one entry for another (a rename) keeps the count, and passes.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONFIG = ".oxlintrc.json";
const SIZE_RULES = [
  "max-lines",
  "max-lines-per-function",
  "max-params",
  "max-depth",
  "max-statements",
  "max-nested-callbacks",
  "complexity",
];

// .oxlintrc.json is JSON with comments and trailing commas.
function parseJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

// How many file patterns each size rule is switched off for.
function exemptions(config) {
  const counts = Object.fromEntries(SIZE_RULES.map((rule) => [rule, 0]));
  for (const { files = [], rules = {} } of config.overrides ?? []) {
    for (const rule of SIZE_RULES) {
      if (rules[rule] === "off") counts[rule] += files.length;
    }
  }
  return counts;
}

function atHead() {
  try {
    return execFileSync("git", ["show", `HEAD:${CONFIG}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const head = atHead();
if (head === null) process.exit(0);

const before = exemptions(parseJsonc(head));
const after = exemptions(
  parseJsonc(readFileSync(process.argv[2] ?? CONFIG, "utf8"))
);
const grown = SIZE_RULES.filter((rule) => after[rule] > before[rule]);

if (grown.length > 0) {
  console.error(
    `${CONFIG} exempts more files from the size rules than HEAD:\n`
  );
  for (const rule of grown) {
    console.error(`  ${rule}: ${before[rule]} -> ${after[rule]}`);
  }
  console.error(`
The exemption lists may only shrink. Make the new code pass the rule: split
the long function or the deep nesting where it lands, rather than exempting
the file it moved to. Moving an entry from a file you split to the file that
took its code keeps the count, and passes.`);
  process.exit(1);
}
