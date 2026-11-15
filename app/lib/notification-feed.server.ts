// ─── Notification feed ───
// See GLOSSARY.md, "Notification", and ADR 0013. The browser reads the
// person's feed straight from Knock with the public key and a user token
// signed here. The token only grants that person's own feed.

import { signUserToken } from "@knocklabs/node";
// Loads .env, so the Knock keys below are set whichever module runs first.
import "~/lib/env.server";

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
export async function getFeedConfig(
  userId: number
): Promise<FeedConfig | null> {
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
