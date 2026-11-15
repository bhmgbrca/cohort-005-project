import type {
  Notification,
  NotificationTransport,
} from "~/lib/notifier.server";

/** Keeps every Notification it is handed in memory, for tests to inspect. */
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
