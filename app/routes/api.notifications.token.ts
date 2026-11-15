import { data } from "react-router";
import type { Route } from "./+types/api.notifications.token";
import { getCurrentUserId } from "~/lib/session";
import { getFeedConfig } from "~/lib/notifier.server";

/**
 * A fresh Knock user token for the session user, so the Notification feed
 * keeps working past the token's 1-hour expiry. The feed reloads the page on
 * 401 or when `userId` isn't the user it was showing.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const feed = await getFeedConfig(currentUserId);
  if (!feed) {
    throw data("Notifications aren't configured", { status: 404 });
  }

  return { userId: feed.userId, token: feed.userToken };
}
