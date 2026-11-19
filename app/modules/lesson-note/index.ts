import { describeDraft as describe, type NoteDraft } from "./lib/draft";

export type { NoteDraft, NoteDraftStatus } from "./lib/draft";

/**
 * What the Lesson Note editor shows for the text in the box: whether it
 * matches the saved Note, whether Save is allowed, and the character counter.
 * `savedBody` is null when the Student has not saved a Note on this Lesson.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null,
  maxLength: number
): NoteDraft {
  return describe(draft, savedBody, maxLength);
}
