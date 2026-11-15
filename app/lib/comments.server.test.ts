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
});
