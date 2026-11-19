import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "~/test/setup";
import { lessonPage } from "../index.server";
import { decisionsFor, seedCourse } from "./fixtures";

let testDb: TestDb;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

let seeded: ReturnType<typeof seedCourse>;

beforeEach(() => {
  testDb = createTestDb();
  seeded = seedCourse(testDb);
});

async function loadFull(lessonId: number) {
  const page = await lessonPage.load(decisionsFor(seeded, true), lessonId);
  if (page?.view !== "full") throw new Error("expected the full view");
  return page;
}

describe("lessonPage.load", () => {
  it("is null for a lesson that does not exist", async () => {
    expect(await lessonPage.load(decisionsFor(seeded, true), 9999)).toBeNull();
  });

  it("shows only the outline to someone who cannot view the content", async () => {
    const page = await lessonPage.load(
      decisionsFor(seeded, false),
      seeded.lessonIds[0]
    );
    expect(page).toMatchObject({
      view: "locked",
      lesson: { id: seeded.lessonIds[0], title: "Lesson 1" },
      lockedReason: { kind: "not-enrolled" },
    });
    expect(page).not.toHaveProperty("contentHtml");
  });

  it("links the previous and next lessons", async () => {
    const page = await loadFull(seeded.lessonIds[1]);
    expect(page.prevLesson?.id).toBe(seeded.lessonIds[0]);
    expect(page.nextLesson?.id).toBe(seeded.lessonIds[2]);
  });

  it("marks the lesson in progress when the Student opens it", async () => {
    const page = await loadFull(seeded.lessonIds[0]);
    expect(page.lessonStatus).toBe("in_progress");
    expect(page.lessonProgressMap).toEqual({
      [seeded.lessonIds[0]]: "in_progress",
    });
  });

  it("sends the quiz without saying which option is correct", async () => {
    const page = await loadFull(seeded.lessonIds[1]);
    expect(page.quiz?.questions[0].options).toEqual([
      { id: seeded.quiz.right, optionText: "Yes" },
      { id: seeded.quiz.wrong, optionText: "No" },
    ]);
  });
});

describe("lessonPage.markComplete", () => {
  it("completes the lesson, and opening it again keeps it complete", async () => {
    const now = new Date("2026-01-02T03:04:05.000Z");
    const progress = lessonPage.markComplete(
      seeded.user.id,
      seeded.lessonIds[0],
      now
    );
    expect(progress.completedAt).toBe(now.toISOString());
    const page = await loadFull(seeded.lessonIds[0]);
    expect(page.lessonStatus).toBe("completed");
  });
});

describe("lessonPage.submitQuiz", () => {
  it("scores a right answer as a pass and shows it as the best attempt", async () => {
    const result = lessonPage.submitQuiz(seeded.user.id, seeded.quiz.id, {
      [seeded.quiz.questionId]: seeded.quiz.right,
    });
    expect(result).toMatchObject({ score: 1, passed: true, grade: "A" });
    const page = await loadFull(seeded.lessonIds[1]);
    expect(page.bestAttempt).toEqual({ score: 1, passed: true });
  });

  it("scores a wrong answer as a fail", () => {
    const result = lessonPage.submitQuiz(seeded.user.id, seeded.quiz.id, {
      [seeded.quiz.questionId]: seeded.quiz.wrong,
    });
    expect(result).toMatchObject({ score: 0, passed: false, grade: "F" });
  });

  it("finds the quiz by id", () => {
    expect(lessonPage.getQuiz(seeded.quiz.id)?.lessonId).toBe(
      seeded.lessonIds[1]
    );
  });
});
