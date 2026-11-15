import { and, asc, eq, ne } from "drizzle-orm";
import type { Queryable } from "~/db";
import { UserRole, users } from "~/db/schema";

// ─── People ───
// Looking up the people a Notification is from or for. Takes the database (or
// a transaction) first, so tests can hand in an in-memory one.

/** Someone who sends or receives a Notification. Only id and name leave Cadence. */
export type Person = { id: number; name: string };

/** The columns that make a user a Person. */
const personColumns = { id: users.id, name: users.name };

/** The user as a Notification Person (id and name only), if they exist. */
export function getPerson(db: Queryable, userId: number): Person | undefined {
  return db.select(personColumns).from(users).where(eq(users.id, userId)).get();
}

/** Everyone who is a Platform Admin right now, except `exceptUserId`. */
export function getPlatformAdminsExcept(
  db: Queryable,
  exceptUserId: number
): Person[] {
  return db
    .select(personColumns)
    .from(users)
    .where(and(eq(users.role, UserRole.Admin), ne(users.id, exceptUserId)))
    .orderBy(asc(users.id))
    .all();
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
