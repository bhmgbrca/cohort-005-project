import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  comments,
  courses,
  lessons,
  modules,
  UserRole,
  users,
} from "~/db/schema";
import {
  commentUrl,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
} from "~/lib/comments";
import type { Notification, Person } from "~/lib/notifier.server";

// ─── Comments ───
// Posting Questions and Replies under a lesson. See GLOSSARY.md, "Questions".
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention). Access checks (who may
// post on this course) stay in the route actions, which know the session.

type Db = BetterSQLite3Database<typeof schema>;
type Comment = typeof comments.$inferSelect;

/** Trims a comment body and enforces the length limits. Throws if invalid. */
export function assertValidCommentBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

function getCommentById(db: Db, commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

function getCourseForLesson(db: Db, lessonId: number) {
  return db
    .select({
      courseId: courses.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
      instructorId: courses.instructorId,
      lessonTitle: lessons.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

function getUser(db: Db, userId: number) {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}

function toPerson(user: { id: number; name: string }): Person {
  return { id: user.id, name: user.name };
}

type Course = NonNullable<ReturnType<typeof getCourseForLesson>>;

/**
 * Reply to your Question (E), for the asker. `null` when they Replied to
 * their own Question. "Answered" when the Reply makes it an Answered Question.
 */
function replyNotification(
  db: Db,
  course: Course,
  question: Comment,
  reply: Comment
): Notification | null {
  if (reply.userId === question.userId) return null;

  const asker = getUser(db, question.userId);
  const author = getUser(db, reply.userId);
  if (!asker || !author) return null;

  return {
    kind: "reply-to-question",
    recipients: [toPerson(asker)],
    actor: toPerson(author),
    url: commentUrl(course.courseSlug, reply.lessonId, reply.id),
    questionId: question.id,
    replyId: reply.id,
    lessonTitle: course.lessonTitle,
    answered:
      author.id === course.instructorId || author.role === UserRole.Admin,
  };
}

/**
 * New Question (F), for the course's Instructor. `null` when the Instructor
 * asked it. Platform Admins never get F.
 */
function newQuestionNotification(
  db: Db,
  course: Course,
  question: Comment
): Notification | null {
  if (question.userId === course.instructorId) return null;

  const instructor = getUser(db, course.instructorId);
  const asker = getUser(db, question.userId);
  if (!instructor || !asker) return null;

  return {
    kind: "new-question",
    recipients: [toPerson(instructor)],
    actor: toPerson(asker),
    url: commentUrl(course.courseSlug, question.lessonId, question.id),
    questionId: question.id,
    lessonTitle: course.lessonTitle,
    courseTitle: course.courseTitle,
  };
}

/**
 * Posts a Question (`parentId` null) or a Reply to a Question on a lesson.
 * Throws an Error with a user-facing message when the body or parent is
 * invalid; nobody can reply to a Reply.
 *
 * Returns the Notification it causes, if any, for the route to `notify` after
 * the write.
 */
export function createComment(
  db: Db,
  userId: number,
  lessonId: number,
  parentId: number | null,
  body: string
): { comment: Comment; notification: Notification | null } {
  const trimmed = assertValidCommentBody(body);

  const course = getCourseForLesson(db, lessonId);
  if (!course) {
    throw new Error("Lesson not found");
  }

  let parent: Comment | undefined;
  if (parentId !== null) {
    parent = getCommentById(db, parentId);
    if (!parent) {
      throw new Error("Parent comment not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("Parent comment belongs to a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Replies can only be one level deep");
    }
  }

  const comment = db
    .insert(comments)
    .values({ userId, lessonId, parentId, body: trimmed })
    .returning()
    .get();

  const notification = parent
    ? replyNotification(db, course, parent, comment)
    : newQuestionNotification(db, course, comment);

  return { comment, notification };
}
