import { describe, expect, it } from "vitest";
import { parseRefreshedToken } from "./notification-feed";

describe("parseRefreshedToken", () => {
  it("reads the user id and token the refresh route answers with", () => {
    expect(parseRefreshedToken({ userId: "42", token: "abc.def.ghi" })).toEqual(
      {
        userId: "42",
        token: "abc.def.ghi",
      }
    );
  });

  it("is null for a body that isn't a refreshed token, so the feed reloads", () => {
    expect(parseRefreshedToken({ userId: 42 })).toBeNull();
    expect(parseRefreshedToken("<html>")).toBeNull();
    expect(parseRefreshedToken(null)).toBeNull();
  });
});
