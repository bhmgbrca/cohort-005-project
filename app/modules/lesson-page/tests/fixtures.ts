import * as schema from "~/db/schema";
import { seedBaseData, type TestDb } from "~/test/setup";
import type { CourseDecisions } from "~/modules/permissions/course-permissions.server";

/** A course with one module of three lessons; the second has a quiz. */
export function seedCourse(db: TestDb) {
  const base = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  const lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
  const quiz = seedQuiz(db, lessonIds[1]);
  return { ...base, lessonIds, quiz };
}

function seedQuiz(db: TestDb, lessonId: number) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const question = db
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "Is TypeScript typed?",
      questionType: schema.QuestionType.TrueFalse,
      position: 1,
    })
    .returning()
    .get();
  const [right, wrong] = [true, false].map(
    (isCorrect) =>
      db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: isCorrect ? "Yes" : "No",
          isCorrect,
        })
        .returning()
        .get().id
  );
  return { id: quiz.id, questionId: question.id, right, wrong };
}

type Seeded = ReturnType<typeof seedCourse>;

export function decisionsFor(
  seeded: Seeded,
  allowed: boolean
): Extract<CourseDecisions, { found: true }> {
  const decision = allowed
    ? { allowed: true as const }
    : { allowed: false as const, reason: { kind: "not-enrolled" as const } };
  return {
    found: true,
    course: seeded.course,
    person: { id: seeded.user.id, role: "student", country: null },
    enrolled: allowed,
    view: decision,
    take: decision,
    manage: { allowed: false, reason: { kind: "signed-out" } },
  };
}
