import { z } from "zod";

// ─── Notification feed token refresh ───
// What the browser and the token route agree on. See
// app/routes/api.notifications.token.ts and app/components/notification-feed.tsx.

export const TOKEN_REFRESH_URL = "/api/notifications/token";

const refreshedTokenSchema = z.object({
  /** The Knock user id: the Cadence user id as a string. */
  userId: z.string(),
  token: z.string(),
});

export type RefreshedToken = z.infer<typeof refreshedTokenSchema>;

/** The token route's answer, or `null` when the body isn't one. */
export function parseRefreshedToken(body: unknown): RefreshedToken | null {
  const parsed = refreshedTokenSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}
