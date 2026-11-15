import { eq } from "drizzle-orm";
import type { Queryable } from "~/db";
import { UserRole, users } from "~/db/schema";

// ─── People ───
// Looking up the people a Notification is from or for. Takes the database (or
// a transaction) first, so tests can hand in an in-memory one.

/** Someone who sends or receives a Notification. Only id and name leave Cadence. */
export type Person = { id: number; name: string };

/** The user as a Notification Person (id and name only), if they exist. */
export function getPerson(db: Queryable, userId: number): Person | undefined {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}

/** Whether the user exists and is a Platform Admin. */
export function isPlatformAdmin(db: Queryable, userId: number): boolean {
  const user = db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return user?.role === UserRole.Admin;
}
