import { data } from "react-router";
import type { Route } from "./+types/api.notifications.token";
import { getCurrentUserId } from "~/lib/session";
import { getFeedConfig } from "~/lib/notification-feed.server";
import type { RefreshedToken } from "~/lib/notification-feed";

/**
 * A fresh Knock user token for the session user, so the Notification feed
 * keeps working past the token's 1-hour expiry. Answers `{ userId, token }` or
 * 401: with no session user, or when Knock isn't configured (any more), since
 * either way this tab can't have a feed. The feed reloads the page on any
 * failure or when `userId` isn't the user it was showing.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const feed = await getFeedConfig(currentUserId);
  if (!feed) {
    throw data("Notifications aren't configured", { status: 401 });
  }

  return {
    userId: feed.userId,
    token: feed.userToken,
  } satisfies RefreshedToken;
}
