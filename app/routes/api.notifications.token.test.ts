import { afterEach, describe, expect, it, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { setCurrentUserId } from "~/lib/session";
import { loader } from "./api.notifications.token";

const TOKEN_URL = "http://localhost/api/notifications/token";

async function requestAs(userId: number) {
  const cookie = await setCurrentUserId(new Request(TOKEN_URL), userId);
  return new Request(TOKEN_URL, { headers: { Cookie: cookie } });
}

async function statusOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (thrown) {
    if (
      thrown &&
      typeof thrown === "object" &&
      "init" in thrown &&
      thrown.init &&
      typeof thrown.init === "object" &&
      "status" in thrown.init
    ) {
      return thrown.init.status;
    }
    throw thrown;
  }
  return 200;
}

function loaderArgs(request: Request): Parameters<typeof loader>[0] {
  return {
    request,
    params: {},
    context: new RouterContextProvider(),
    url: new URL(request.url),
    pattern: "/api/notifications/token",
  };
}

describe("token refresh", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is 401 without a session user", async () => {
    const status = await statusOf(() =>
      loader(loaderArgs(new Request(TOKEN_URL)))
    );
    expect(status).toBe(401);
  });

  it("is 401 when Knock isn't configured, so the feed reloads", async () => {
    vi.stubEnv("KNOCK_PUBLIC_API_KEY", "");
    vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "");
    vi.stubEnv("KNOCK_SIGNING_KEY", "");

    const status = await statusOf(async () =>
      loader(loaderArgs(await requestAs(42)))
    );
    expect(status).toBe(401);
  });
});
