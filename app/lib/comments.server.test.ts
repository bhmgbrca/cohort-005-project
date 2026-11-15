import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { createComment } from "./comments.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let moduleId: number;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  moduleId = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get().id;

  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
});

describe("createComment", () => {
  it("posts a Question on a lesson", () => {
    const { comment } = createComment(
      db,
      base.user.id,
      lessonId,
      null,
      "  How do I start?  "
    );

    expect(comment).toMatchObject({
      userId: base.user.id,
      lessonId,
      parentId: null,
      body: "How do I start?",
    });
  });

  it("posts a Reply to a Question", () => {
    const { comment: question } = createComment(
      db,
      base.user.id,
      lessonId,
      null,
      "How do I start?"
    );

    const { comment: reply } = createComment(
      db,
      base.instructor.id,
      lessonId,
      question.id,
      "Watch the intro first."
    );

    expect(reply).toMatchObject({
      userId: base.instructor.id,
      lessonId,
      parentId: question.id,
      body: "Watch the intro first.",
    });
  });

  it("refuses a Reply to a Reply", () => {
    const { comment: question } = createComment(
      db,
      base.user.id,
      lessonId,
      null,
      "How do I start?"
    );
    const { comment: reply } = createComment(
      db,
      base.instructor.id,
      lessonId,
      question.id,
      "Watch the intro."
    );

    expect(() =>
      createComment(db, base.user.id, lessonId, reply.id, "Thanks!")
    ).toThrow("Replies can only be one level deep");
  });

  it("refuses a Reply to a Question on a different lesson", () => {
    const { comment: question } = createComment(
      db,
      base.user.id,
      lessonId,
      null,
      "How do I start?"
    );
    const otherLessonId = db
      .insert(schema.lessons)
      .values({ moduleId, title: "Lesson 2", position: 2 })
      .returning()
      .get().id;

    expect(() =>
      createComment(db, base.instructor.id, otherLessonId, question.id, "Hi")
    ).toThrow("Parent comment belongs to a different lesson");
  });

  it("refuses an empty body", () => {
    expect(() =>
      createComment(db, base.user.id, lessonId, null, "   ")
    ).toThrow("Comment cannot be empty");
  });

  it("refuses a body over 5000 characters", () => {
    expect(() =>
      createComment(db, base.user.id, lessonId, null, "a".repeat(5001))
    ).toThrow("Comment must be 5000 characters or fewer");
  });

  it("accepts a body of exactly 5000 characters", () => {
    const { comment } = createComment(
      db,
      base.user.id,
      lessonId,
      null,
      "a".repeat(5000)
    );
    expect(comment.body).toHaveLength(5000);
  });

  describe("Reply to your Question Notification", () => {
    it("tells the asker the Instructor answered their Question, linking to the Reply", () => {
      const { comment: question } = createComment(
        db,
        base.user.id,
        lessonId,
        null,
        "How do I start?"
      );

      const { comment: reply, notification } = createComment(
        db,
        base.instructor.id,
        lessonId,
        question.id,
        "Watch the intro first."
      );

      expect(notification).toEqual({
        kind: "reply-to-question",
        recipients: [{ id: base.user.id, name: "Test User" }],
        actor: { id: base.instructor.id, name: "Test Instructor" },
        url: `/courses/test-course/lessons/${lessonId}#comment-${reply.id}`,
        questionId: question.id,
        replyId: reply.id,
        lessonTitle: "Lesson 1",
        answered: true,
      });
    });

    function addUser(name: string, role: schema.UserRole) {
      return db
        .insert(schema.users)
        .values({ name, email: `${name.toLowerCase()}@example.com`, role })
        .returning()
        .get();
    }

    function askQuestion() {
      return createComment(db, base.user.id, lessonId, null, "How?").comment;
    }

    it("says another Student replied to, not answered, the Question", () => {
      const question = askQuestion();
      const other = addUser("Mia", schema.UserRole.Student);

      const { notification } = createComment(
        db,
        other.id,
        lessonId,
        question.id,
        "Same question here."
      );

      expect(notification).toMatchObject({
        kind: "reply-to-question",
        recipients: [{ id: base.user.id, name: "Test User" }],
        actor: { id: other.id, name: "Mia" },
        answered: false,
      });
    });

    it("says a Platform Admin answered the Question", () => {
      const question = askQuestion();
      const admin = addUser("Ops", schema.UserRole.Admin);

      const { notification } = createComment(
        db,
        admin.id,
        lessonId,
        question.id,
        "Here's how."
      );

      expect(notification).toMatchObject({
        actor: { id: admin.id, name: "Ops" },
        answered: true,
      });
    });

    it("doesn't notify anyone of a Reply to their own Question", () => {
      const question = askQuestion();

      const { notification } = createComment(
        db,
        base.user.id,
        lessonId,
        question.id,
        "Never mind, found it."
      );

      expect(notification).toBeNull();
    });
  });

  describe("New Question Notification", () => {
    it("tells the course's Instructor someone asked a Question, linking to it", () => {
      const { comment: question, notification } = createComment(
        db,
        base.user.id,
        lessonId,
        null,
        "How do I start?"
      );

      expect(notification).toEqual({
        kind: "new-question",
        recipients: [{ id: base.instructor.id, name: "Test Instructor" }],
        actor: { id: base.user.id, name: "Test User" },
        url: `/courses/test-course/lessons/${lessonId}#comment-${question.id}`,
        questionId: question.id,
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
      });
    });

    it("doesn't notify anyone of the Instructor's own Question", () => {
      const { notification } = createComment(
        db,
        base.instructor.id,
        lessonId,
        null,
        "Any questions so far?"
      );

      expect(notification).toBeNull();
    });

    it("never sends it to Platform Admins, even when one asks", () => {
      const admin = db
        .insert(schema.users)
        .values({
          name: "Ops",
          email: "ops@example.com",
          role: schema.UserRole.Admin,
        })
        .returning()
        .get();

      const { notification } = createComment(
        db,
        admin.id,
        lessonId,
        null,
        "Is this lesson up to date?"
      );

      expect(notification).toMatchObject({
        kind: "new-question",
        recipients: [{ id: base.instructor.id, name: "Test Instructor" }],
        actor: { id: admin.id, name: "Ops" },
      });
    });
  });
});
