// ─── In-app Notifications ───
// See GLOSSARY.md, "Notification", and ADR 0013. Domain functions decide who
// gets a Notification and return it; route actions hand it to `notify` after
// the database write.
//
// Knock delivers Notifications when KNOCK_SECRET_API_KEY is set. Without it,
// and always under Vitest, each one is printed to the console instead. Knock's
// vocabulary (workflow keys, string ids, data) stays inside `knockTransport`.

import Knock, { signUserToken } from "@knocklabs/node";
import { isUnderVitest } from "~/lib/env.server";

/** Someone who sends or receives a Notification. Only id and name leave Cadence. */
export type Person = { id: number; name: string };

type NotificationBase = {
  recipients: Person[];
  /** The person who caused the event. Never one of the recipients. */
  actor: Person;
  /** In-app path the Notification links to. */
  url: string;
};

/** E: someone Replied to the recipient's Question. */
export type ReplyToQuestionNotification = NotificationBase & {
  kind: "reply-to-question";
  questionId: number;
  replyId: number;
  lessonTitle: string;
  /** The Reply makes it an Answered Question (Instructor or Platform Admin). */
  answered: boolean;
};

/** One variant per launch Notification, distinguished by `kind`. */
export type Notification = ReplyToQuestionNotification;

/** The markdown body shown in the feed. */
export function notificationText(notification: Notification): string {
  switch (notification.kind) {
    case "reply-to-question": {
      const verb = notification.answered ? "answered" : "replied to";
      return `${notification.actor.name} **${verb}** your Question on *${notification.lessonTitle}*.`;
    }
  }
}

// ─── Transports ───
// A transport delivers one Notification to every recipient. Transports are
// simple and may throw; `notify` absorbs failures.

/** `notify` gives up on a send after this long. */
const SEND_TIMEOUT_MS = 3000;

export interface NotificationTransport {
  send(notification: Notification): Promise<void>;
}

/** Keeps every Notification in memory. Used by tests. */
export function recordingTransport(): NotificationTransport & {
  sent: Notification[];
} {
  const sent: Notification[] = [];
  return {
    sent,
    async send(notification) {
      sent.push(notification);
    },
  };
}

/** Prints "would send …" instead of sending. Used without Knock keys and in tests. */
export function logOnlyTransport(): NotificationTransport {
  return {
    async send(notification) {
      const to = notification.recipients
        .map((r) => `${r.name} (${r.id})`)
        .join(", ");
      console.log(
        `[notify] would send ${notification.kind} to ${to}: ${notificationText(notification)} -> ${notification.url}`
      );
    },
  };
}

function knockRecipient(person: Person) {
  // Identified inline every time: Knock silently skips recipients it hasn't
  // seen. Only id and name, nothing else about the person.
  return { id: String(person.id), name: person.name };
}

/** One Knock workflow trigger per Notification; the workflow key is its `kind`. */
export function knockTransport(secretApiKey: string): NotificationTransport {
  // No retries: a retry after a timeout could deliver twice.
  const knock = new Knock({
    apiKey: secretApiKey,
    maxRetries: 0,
    timeout: SEND_TIMEOUT_MS,
  });
  return {
    async send(notification) {
      await knock.workflows.trigger(notification.kind, {
        recipients: notification.recipients.map(knockRecipient),
        actor: knockRecipient(notification.actor),
        data: { body: notificationText(notification), url: notification.url },
      });
    },
  };
}

/** Knock when its secret key is set, except under Vitest; otherwise log-only. */
export function defaultTransport(): NotificationTransport {
  const secretApiKey = process.env.KNOCK_SECRET_API_KEY;
  return secretApiKey && !isUnderVitest()
    ? knockTransport(secretApiKey)
    : logOnlyTransport();
}

/** The record that caused a Notification, for the failure log. */
function triggeringRecord(notification: Notification): string {
  switch (notification.kind) {
    case "reply-to-question":
      return `reply ${notification.replyId} on question ${notification.questionId}`;
  }
}

function withTimeout(sending: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([sending, timeout]).finally(() => clearTimeout(timer));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends a Notification. Never throws: one attempt, at most 3 seconds, and on failure or timeout it logs
 * the kind, recipient ids, triggering record and error, then returns, so the
 * person acting never notices.
 */
export async function notify(
  notification: Notification,
  transport: NotificationTransport = defaultTransport()
): Promise<void> {
  try {
    await withTimeout(transport.send(notification), SEND_TIMEOUT_MS);
  } catch (error) {
    const recipientIds = notification.recipients.map((r) => r.id).join(", ");
    console.error(
      `[notify] ${notification.kind} failed (recipients ${recipientIds}; ${triggeringRecord(notification)}): ${describeError(error)}`
    );
  }
}

// ─── Feed ───
// The browser reads the person's feed straight from Knock with the public key
// and a user token signed here. The token only grants that person's own feed.

/** What the sidebar's Notification feed needs. Safe to send to the browser. */
export type FeedConfig = {
  publicApiKey: string;
  feedChannelId: string;
  /** The Knock user id: the Cadence user id as a string. */
  userId: string;
  userToken: string;
};

const USER_TOKEN_LIFETIME_SECONDS = 60 * 60;

/**
 * Signs a 1-hour Knock user token (RS256, locally) for the person's feed.
 * Returns `null` when the Knock keys aren't configured, so there's no bell.
 */
export async function getFeedConfig(userId: number): Promise<FeedConfig | null> {
  const publicApiKey = process.env.KNOCK_PUBLIC_API_KEY;
  const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
  // Base64-encoded PEM or raw PEM; Knock accepts either as-is.
  const signingKey = process.env.KNOCK_SIGNING_KEY;
  if (!publicApiKey || !feedChannelId || !signingKey) return null;

  const knockUserId = String(userId);
  const userToken = await signUserToken(knockUserId, {
    signingKey,
    expiresInSeconds: USER_TOKEN_LIFETIME_SECONDS,
  });
  return { publicApiKey, feedChannelId, userId: knockUserId, userToken };
}
