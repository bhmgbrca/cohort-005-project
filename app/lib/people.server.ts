import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { UserRole, users } from "~/db/schema";
import type { Person } from "~/lib/notifier.server";

// ─── People ───
// Looking up the people a Notification is from or for. Takes the database (or
// a transaction) first, so tests can hand in an in-memory one.

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Queryable = Db | Tx;

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
