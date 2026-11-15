import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTransport,
  getFeedConfig,
  notificationText,
  notify,
  type Notification,
} from "./notifier.server";
import type { PurchaseKind } from "./refunds.server";
import { recordingTransport } from "~/test/recording-transport";

function replyToQuestion(answered: boolean): Notification {
  return {
    kind: "reply-to-question",
    recipients: [{ id: 1, name: "Liam Student" }],
    actor: { id: 2, name: "Ada Instructor" },
    url: "/courses/intro/lessons/7#comment-12",
    questionId: 11,
    replyId: 12,
    lessonTitle: "Getting Started",
    answered,
  };
}

describe("notificationText", () => {
  it("says the Reply answered the Question when it makes it an Answered Question", () => {
    expect(notificationText(replyToQuestion(true))).toBe(
      "Ada Instructor **answered** your Question on *Getting Started*."
    );
  });

  it("says someone replied to the Question when it doesn't answer it", () => {
    expect(notificationText(replyToQuestion(false))).toBe(
      "Ada Instructor **replied to** your Question on *Getting Started*."
    );
  });
});

function newRefundRequest(purchaseKind: PurchaseKind): Notification {
  return {
    kind: "new-refund-request",
    recipients: [{ id: 3, name: "Pat Admin" }],
    actor: { id: 1, name: "Liam Student" },
    url: "/admin/refunds",
    refundRequestId: 21,
    courseTitle: "Intro to TypeScript",
    amountPaid: 7900,
    purchaseKind,
  };
}

describe("notificationText for New Refund Request", () => {
  it("names the buyer, course, amount and Individual Purchase", () => {
    expect(notificationText(newRefundRequest("individual_purchase"))).toBe(
      "**New Refund Request** from Liam Student for *Intro to TypeScript*: $79.00, Individual Purchase."
    );
  });

  it("says Team Licence for a Team Licence", () => {
    expect(notificationText(newRefundRequest("team_licence"))).toBe(
      "**New Refund Request** from Liam Student for *Intro to TypeScript*: $79.00, Team Licence."
    );
  });
});

function refundApproved(
  overrides: Partial<{ purchaseKind: PurchaseKind; note: string | null }> = {}
): Notification {
  return {
    kind: "refund-approved",
    recipients: [{ id: 1, name: "Liam Student" }],
    actor: { id: 3, name: "Pat Admin" },
    url: "/settings",
    refundRequestId: 21,
    courseTitle: "Intro to Testing",
    amountPaid: 7900,
    purchaseKind: "individual_purchase",
    note: null,
    ...overrides,
  };
}

function refundDeclined(
  overrides: Partial<{ purchaseKind: PurchaseKind; note: string }> = {}
): Notification {
  return {
    kind: "refund-declined",
    recipients: [{ id: 1, name: "Liam Student" }],
    actor: { id: 3, name: "Pat Admin" },
    url: "/settings",
    refundRequestId: 21,
    courseTitle: "Intro to Testing",
    amountPaid: 7900,
    purchaseKind: "individual_purchase",
    note: "You finished the course.",
    ...overrides,
  };
}

describe("notificationText for Refund Request approved", () => {
  it("tells the buyer the amount is on its way and their Enrollment has ended", () => {
    expect(notificationText(refundApproved())).toBe(
      "**Refund approved** for *Intro to Testing*. $79.00 is on its way back to you. Your Enrollment has ended."
    );
  });

  it("tells a Team Admin their Unclaimed Seats can no longer be claimed", () => {
    expect(notificationText(refundApproved({ purchaseKind: "team_licence" }))).toBe(
      "**Refund approved** for *Intro to Testing*. $79.00 is on its way back to you. Your Unclaimed Seats can no longer be claimed."
    );
  });

  it("puts the admin's note on a new line", () => {
    expect(notificationText(refundApproved({ note: "Sorry it didn't work out." }))).toBe(
      '**Refund approved** for *Intro to Testing*. $79.00 is on its way back to you. Your Enrollment has ended.\n"Sorry it didn\'t work out."'
    );
  });

  it("cuts a long note to 200 characters with an ellipsis", () => {
    const note = "a".repeat(199) + "bc";
    expect(notificationText(refundApproved({ note }))).toBe(
      `**Refund approved** for *Intro to Testing*. $79.00 is on its way back to you. Your Enrollment has ended.\n"${"a".repeat(199)}b…"`
    );
  });

  it("keeps a note of exactly 200 characters whole", () => {
    const note = "a".repeat(200);
    expect(notificationText(refundApproved({ note }))).toContain(`"${note}"`);
  });
});

describe("notificationText for Refund Request declined", () => {
  it("quotes the admin's note and reassures the buyer", () => {
    expect(notificationText(refundDeclined())).toBe(
      '**Refund declined** for *Intro to Testing*: "You finished the course." You still have everything you bought.'
    );
  });

  it("uses the same wording for a Team Licence", () => {
    expect(notificationText(refundDeclined({ purchaseKind: "team_licence" }))).toBe(
      '**Refund declined** for *Intro to Testing*: "You finished the course." You still have everything you bought.'
    );
  });

  it("cuts a long note to 200 characters with an ellipsis", () => {
    const note = "x".repeat(250);
    expect(notificationText(refundDeclined({ note }))).toBe(
      `**Refund declined** for *Intro to Testing*: "${"x".repeat(200)}…" You still have everything you bought.`
    );
  });
});

describe("notificationText for New Question", () => {
  it("names the asker, lesson and course", () => {
    expect(
      notificationText({
        kind: "new-question",
        recipients: [{ id: 2, name: "Ada Instructor" }],
        actor: { id: 1, name: "Liam Student" },
        url: "/courses/intro/lessons/7#comment-11",
        questionId: 11,
        lessonTitle: "Getting Started",
        courseTitle: "Intro to Cadence",
      })
    ).toBe(
      "Liam Student **asked a Question** on *Getting Started* in *Intro to Cadence*."
    );
  });
});

describe("notificationText for Seat claimed", () => {
  it("names the Student and course with the Seat counts at that moment", () => {
    const seatClaimed: Notification = {
      kind: "seat-claimed",
      recipients: [{ id: 3, name: "Tess Admin" }],
      actor: { id: 1, name: "Liam Student" },
      url: "/team",
      seatId: 21,
      courseTitle: "Intro to TypeScript",
      claimed: 3,
      total: 5,
    };

    expect(notificationText(seatClaimed)).toBe(
      "Liam Student **claimed a Seat** on *Intro to TypeScript*. 3 of 5 Seats claimed."
    );
  });
});

describe("notify", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("hands the Notification to the transport", async () => {
    const transport = recordingTransport();
    const notification = replyToQuestion(true);

    await notify(notification, transport);

    expect(transport.sent).toEqual([notification]);
  });

  it("does nothing when there is no Notification", async () => {
    const transport = recordingTransport();

    await notify(null, transport);

    expect(transport.sent).toEqual([]);
  });

  it("logs a failed send with its kind, recipients, triggering record and error, without throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = {
      async send() {
        throw new Error("404 workflow not found in this environment");
      },
    };

    await expect(
      notify(replyToQuestion(true), failing)
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    const message = String(log.mock.calls[0][0]);
    expect(message).toContain("reply-to-question");
    expect(message).toContain("recipients 1");
    expect(message).toContain("reply 12 on question 11");
    expect(message).toContain("404 workflow not found in this environment");
  });

  it("gives up on a transport that hangs after 3 seconds and logs a timeout", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const hanging = { send: () => new Promise<void>(() => {}) };

    let settled = false;
    const sending = notify(replyToQuestion(false), hanging).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await sending;
    expect(settled).toBe(true);
    expect(String(log.mock.calls[0][0])).toContain("timed out after 3000ms");
  });
});

describe("defaultTransport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('only prints "would send …" under Vitest, even when the Knock secret key is set', async () => {
    vi.stubEnv("KNOCK_SECRET_API_KEY", "sk_test_should_never_be_used");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await defaultTransport().send(replyToQuestion(true));

    expect(log).toHaveBeenCalledTimes(1);
    const message = String(log.mock.calls[0][0]);
    expect(message).toContain("would send reply-to-question");
    expect(message).toContain("Ada Instructor **answered** your Question");
    expect(message).toContain("/courses/intro/lessons/7#comment-12");
  });
});

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
