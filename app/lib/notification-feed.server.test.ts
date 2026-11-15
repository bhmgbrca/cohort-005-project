import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFeedConfig } from "./notification-feed.server";

describe("getFeedConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function stubKnockKeys(signingKey: string) {
    vi.stubEnv("KNOCK_PUBLIC_API_KEY", "pk_test_public");
    vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "feed-channel-id");
    vi.stubEnv("KNOCK_SIGNING_KEY", signingKey);
  }

  function rsaKeyPair() {
    return generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  }

  function decodeSegment(segment: string) {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  }

  function verifiesWith(token: string, publicKey: string) {
    const [header, payload, signature] = token.split(".");
    return createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature, "base64url"));
  }

  it("returns null when the Knock keys aren't configured", async () => {
    vi.stubEnv("KNOCK_PUBLIC_API_KEY", "");
    vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "");
    vi.stubEnv("KNOCK_SIGNING_KEY", "");

    expect(await getFeedConfig(42)).toBeNull();
  });

  it("returns null when only some of the keys are configured", async () => {
    stubKnockKeys(rsaKeyPair().privateKey);
    vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "");

    expect(await getFeedConfig(42)).toBeNull();
  });

  it("signs an RS256 token for the user that expires in an hour, from a base64-encoded PEM", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-14T12:00:00Z") });
    const { privateKey, publicKey } = rsaKeyPair();
    stubKnockKeys(Buffer.from(privateKey).toString("base64"));

    const config = await getFeedConfig(42);

    expect(config).toMatchObject({
      publicApiKey: "pk_test_public",
      feedChannelId: "feed-channel-id",
      userId: "42",
    });
    if (!config) throw new Error("expected a feed config");
    const [header, payload] = config.userToken.split(".");
    expect(decodeSegment(header).alg).toBe("RS256");
    const claims = decodeSegment(payload);
    expect(claims.sub).toBe("42");
    expect(claims.exp).toBe(Date.parse("2026-11-14T13:00:00Z") / 1000);
    expect(verifiesWith(config.userToken, publicKey)).toBe(true);
  });

  it("accepts the signing key as a raw PEM too", async () => {
    const { privateKey, publicKey } = rsaKeyPair();
    stubKnockKeys(privateKey);

    const config = await getFeedConfig(7);

    if (!config) throw new Error("expected a feed config");
    expect(config.userId).toBe("7");
    expect(verifiesWith(config.userToken, publicKey)).toBe(true);
  });
});
