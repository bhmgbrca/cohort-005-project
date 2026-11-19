export type NoteDraftStatus =
  | { kind: "empty" }
  | { kind: "too-long"; over: number }
  | { kind: "unsaved" }
  | { kind: "saved" };

export type NoteDraft = {
  status: NoteDraftStatus;
  canSave: boolean;
  counter: string;
};

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
  // The server trims before it stores, so a trailing newline is not an edit.
  const trimmed = draft.trim();
  const counter = `${trimmed.length.toLocaleString("en")} / ${maxLength.toLocaleString("en")}`;
  const status = statusOf(trimmed, savedBody, maxLength);
  return { status, canSave: status.kind === "unsaved", counter };
}

function statusOf(
  trimmed: string,
  savedBody: string | null,
  maxLength: number
): NoteDraftStatus {
  if (trimmed.length > maxLength) {
    return { kind: "too-long", over: trimmed.length - maxLength };
  }
  if (trimmed === savedBody) return { kind: "saved" };
  if (trimmed.length === 0) return { kind: "empty" };
  return { kind: "unsaved" };
}
