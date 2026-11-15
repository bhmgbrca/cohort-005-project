import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTransport,
  notificationText,
  notify,
  recordingTransport,
  type Notification,
} from "./notifier.server";

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

function newRefundRequest(
  purchaseKind: "individual_purchase" | "team_licence"
): Notification {
  return {
    kind: "new-refund-request",
    recipients: [{ id: 3, name: "Pat Admin" }],
    actor: { id: 1, name: "Liam Student" },
    url: "/admin/refunds",
    refundRequestId: 21,
    courseTitle: "Intro to TypeScript",
    amount: 7900,
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
