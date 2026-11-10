/**
 * Whether a comment is worth drawing at all.
 *
 * Three surfaces show the same thing — the annotation card (pending summary and
 * history share one component), the mark preview and the hand-off panel. A
 * comment the user never wrote is not a state to report: the quote above it
 * already identifies the annotation, and printing "no comment added" in three
 * places is pure noise. So the block disappears instead of announcing its own
 * emptiness.
 *
 * Emptiness is judged on the trimmed text, so a comment made of spaces counts as
 * none; once a comment survives that check its inner line breaks are kept as
 * authored. Keeping the rule here (and not in the three renderers) is what makes
 * the surfaces impossible to drift apart.
 */
export interface CommentBlock {
  readonly text: string
}

export function commentBlockOf(comment: string | null | undefined): CommentBlock | null {
  if (comment === null || comment === undefined) return null
  const text = comment.trim()
  return text === '' ? null : { text }
}
