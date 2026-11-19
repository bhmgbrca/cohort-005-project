import { loadLessonPage } from "./lib/load.server";
import { markLessonComplete } from "./lib/progress.server";
import { getCommentById } from "./lib/thread.server";
import { computeResult, getQuizById } from "./lib/quiz.server";

/**
 * The Lesson page's data: what the loader shows, and the reads and writes its
 * action needs. Callers check permissions first; nothing here does.
 */
export const lessonPage = {
  /** The page for a found course, or null when the lesson is missing. */
  load: loadLessonPage,
  /** Marks the lesson completed at `now`, creating progress if needed. */
  markComplete: markLessonComplete,
  getComment: getCommentById,
  getQuiz: getQuizById,
  /** Scores and records a quiz attempt; null if the quiz is gone or it fails. */
  submitQuiz: computeResult,
};
