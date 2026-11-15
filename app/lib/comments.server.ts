import { eq } from "drizzle-orm";
import type { Db } from "~/db";
import { comments, courses, lessons, modules } from "~/db/schema";
import {
  commentUrl,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
} from "~/lib/comments";
import type { Notification } from "~/lib/notifier.server";
import { getPerson, isPlatformAdmin } from "~/lib/people.server";

// ─── Comments ───
// Posting Questions and Replies under a lesson. See GLOSSARY.md, "Questions".
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention). Access checks (who may
// post on this course) stay in the route actions, which know the session.

type Comment = typeof comments.$inferSelect;

/** Trims a Question or Reply body and enforces the length limits. Throws if invalid. */
export function assertValidCommentBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("A Question or Reply cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `A Question or Reply must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

/** A Question or Reply by id, if it exists. */
export function getCommentById(db: Db, commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

/** The course a lesson belongs to, with the lesson's title, if it exists. */
export function getCourseForLesson(db: Db, lessonId: number) {
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

  const asker = getPerson(db, question.userId);
  const author = getPerson(db, reply.userId);
  if (!asker || !author) return null;

  return {
    kind: "reply-to-question",
    recipients: [asker],
    actor: author,
    url: commentUrl(course.courseSlug, reply.lessonId, reply.id),
    questionId: question.id,
    replyId: reply.id,
    lessonTitle: course.lessonTitle,
    answered:
      author.id === course.instructorId || isPlatformAdmin(db, author.id),
  };
}

/**
 * New Question (F), for the course's Instructor. `null` when the Instructor
 * asked it, or when the Instructor is a Platform Admin: Platform Admins never
 * get F.
 */
function newQuestionNotification(
  db: Db,
  course: Course,
  question: Comment
): Notification | null {
  if (question.userId === course.instructorId) return null;
  if (isPlatformAdmin(db, course.instructorId)) return null;

  const instructor = getPerson(db, course.instructorId);
  const asker = getPerson(db, question.userId);
  if (!instructor || !asker) return null;

  return {
    kind: "new-question",
    recipients: [instructor],
    actor: asker,
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
      throw new Error("Question not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("That Question is on a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Nobody can reply to a Reply");
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
