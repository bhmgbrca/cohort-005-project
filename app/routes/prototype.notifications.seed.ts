// PROTOTYPE (#9): sends the role-appropriate launch Notifications to the DevUI user. Never merge.
import { data } from "react-router";
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/prototype.notifications.seed";
import { db } from "~/db";
import { users, teamMembers, TeamMemberRole } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { seedLaunchSet } from "~/lib/knock-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) return data({ sent: 0, error: "no DevUI user" }, 401);
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  const isTeamAdmin = !!db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .get();
  try {
    const sent = await seedLaunchSet(user, user.role, isTeamAdmin);
    return { sent };
  } catch (error) {
    console.error("[notification-feed-prototype] seed failed", error);
    return {
      sent: 0,
      error: String((error as Error).message ?? error).slice(0, 120),
    };
  }
}
