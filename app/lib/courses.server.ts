import { eq } from "drizzle-orm";
import type { Queryable } from "~/db";
import { courses } from "~/db/schema";

// ─── Courses ───
// Small course lookups shared by the domain modules. Takes the database (or a
// transaction) first, so tests can hand in an in-memory one.

/** The course's title, if the course exists. */
export function getCourseTitle(
  db: Queryable,
  courseId: number
): string | undefined {
  return db
    .select({ title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get()?.title;
}
