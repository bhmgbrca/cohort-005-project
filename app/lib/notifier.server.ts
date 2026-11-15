// ─── In-app Notifications ───
// See GLOSSARY.md, "Notification", and ADR 0013. Domain functions decide who
// gets a Notification and return it; route actions hand it to `notify` after
// the database write.
//
// Knock delivers Notifications when KNOCK_SECRET_API_KEY is set. Without it,
// and always under Vitest, each one is printed to the console instead. Knock's
// vocabulary (workflow keys, string ids, data) stays inside `knockTransport`.

import Knock from "@knocklabs/node";
import { isUnderVitest } from "~/lib/env.server";
import { formatPrice } from "~/lib/utils";

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

/** A: a Platform Admin approved the recipient's Refund Request. */
export type RefundApprovedNotification = NotificationBase & {
  kind: "refund-approved";
  refundRequestId: number;
  courseTitle: string;
  /** In cents, the full amount the buyer paid. */
  amountPaid: number;
  teamLicence: boolean;
  /** The admin's note in full; the feed shortens it. */
  note: string | null;
};

/** B: a Platform Admin declined the recipient's Refund Request. */
export type RefundDeclinedNotification = NotificationBase & {
  kind: "refund-declined";
  refundRequestId: number;
  courseTitle: string;
  teamLicence: boolean;
  /** The admin's note in full; the feed shortens it. Always present. */
  note: string;
};

/** F: someone asked a Question on one of the recipient's lessons. */
export type NewQuestionNotification = NotificationBase & {
  kind: "new-question";
  questionId: number;
  lessonTitle: string;
  courseTitle: string;
};

/** One variant per launch Notification, distinguished by `kind`. */
export type Notification =
  | ReplyToQuestionNotification
  | NewQuestionNotification
  | RefundApprovedNotification
  | RefundDeclinedNotification;

/** Admin notes longer than this are cut in the feed; the email has them in full. */
const NOTE_LIMIT = 200;

function shortenNote(note: string): string {
  return note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT)}…` : note;
}

/** The markdown body shown in the feed. */
export function notificationText(notification: Notification): string {
  switch (notification.kind) {
    case "reply-to-question": {
      const verb = notification.answered ? "answered" : "replied to";
      return `${notification.actor.name} **${verb}** your Question on *${notification.lessonTitle}*.`;
    }
    case "new-question":
      return `${notification.actor.name} **asked a Question** on *${notification.lessonTitle}* in *${notification.courseTitle}*.`;
    case "refund-approved": {
      const ended = notification.teamLicence
        ? "Your Unclaimed Seats can no longer be claimed."
        : "Your Enrollment has ended.";
      const text = `**Refund approved** for *${notification.courseTitle}*. ${formatPrice(notification.amountPaid)} is on its way back to you. ${ended}`;
      return notification.note
        ? `${text}\n"${shortenNote(notification.note)}"`
        : text;
    }
    case "refund-declined":
      return `**Refund declined** for *${notification.courseTitle}*: "${shortenNote(notification.note)}" You still have everything you bought.`;
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
    case "new-question":
      return `question ${notification.questionId}`;
    case "refund-approved":
    case "refund-declined":
      return `refund request ${notification.refundRequestId}`;
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
