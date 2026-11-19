import { describe, expect, it } from "vitest";

import {
  estimateTokens,
  findOversizedFiles,
  formatReport,
  MAX_TOKENS,
} from "./check-file-tokens";

const limitInBytes = MAX_TOKENS * 4;

describe("findOversizedFiles", () => {
  it("allows a file exactly at the limit", () => {
    expect(
      findOversizedFiles([{ path: "app/a.ts", bytes: limitInBytes }])
    ).toEqual([]);
  });

  it("flags a file over the limit", () => {
    expect(
      findOversizedFiles([{ path: "app/a.ts", bytes: limitInBytes + 4 }])
    ).toEqual([
      { path: "app/a.ts", bytes: limitInBytes + 4, tokens: MAX_TOKENS + 1 },
    ]);
  });

  it("ignores generated and vendored files", () => {
    const huge = limitInBytes * 10;
    expect(
      findOversizedFiles([
        { path: "package-lock.json", bytes: huge },
        { path: "drizzle/meta/0012_snapshot.json", bytes: huge },
        { path: ".agents/skills/tdd/SKILL.md", bytes: huge },
        { path: "public/logo.png", bytes: huge },
      ])
    ).toEqual([]);
  });

  it("lists the largest file first", () => {
    const result = findOversizedFiles([
      { path: "small.ts", bytes: limitInBytes + 100 },
      { path: "big.ts", bytes: limitInBytes * 3 },
    ]);
    expect(result.map((file) => file.path)).toEqual(["big.ts", "small.ts"]);
  });
});

describe("formatReport", () => {
  it("names each file and tells the agent how to split it", () => {
    const report = formatReport([
      {
        path: "app/routes/big.tsx",
        bytes: 40_000,
        tokens: estimateTokens(40_000),
      },
    ]);
    expect(report).toContain("app/routes/big.tsx: ~10000 tokens");
    expect(report).toContain("How to split");
  });
});
