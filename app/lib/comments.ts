export const MIN_COMMENT_LENGTH = 1;
export const MAX_COMMENT_LENGTH = 5000;

/**
 * The element id for a Question or Reply, so `#comment-<id>` links (e.g. from
 * a Notification) land on it.
 */
export function commentAnchorId(commentId: number) {
  return `comment-${commentId}`;
}

/** The lesson page, scrolled to one Question or Reply. */
export function commentUrl(
  courseSlug: string,
  lessonId: number,
  commentId: number
) {
  return `/courses/${courseSlug}/lessons/${lessonId}#${commentAnchorId(commentId)}`;
}
