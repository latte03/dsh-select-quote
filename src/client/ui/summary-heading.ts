/**
 * What the summary card says when it stands for exactly one annotation.
 *
 * A one-annotation card is not a list of one: there is nothing to count and
 * nothing to choose between, so the card reports the annotation itself — the
 * quote as the title, the comment (when the user wrote one) as the hint. From
 * two annotations up the card is a folder again and keeps its "N 条批注 /
 * hover to view" wording.
 *
 * Both slots are derived together and both come back null when the quote is
 * blank: a card with no title and no hint is an unlabelled button, so the
 * caller must fall back to the count wording instead of half-applying this.
 *
 * Pure on purpose — the card's own render is only a smoke test, and "no comment
 * means no hint line" has no pixels to assert on.
 */
import { commentBlockOf } from './comment-block.ts'

export interface SummaryHeadingSource {
  /** The quote. May be multi-line or padded; this module projects it. */
  readonly title: string
  readonly comment?: string
}

export interface SummaryHeading {
  /** Quote text for the title slot, or null when the count wording applies. */
  readonly quote: string | null
  /** The user's comment for the hint slot, or null to leave that line out. */
  readonly comment: string | null
}

const NONE: SummaryHeading = { quote: null, comment: null }

/**
 * Both slots are single-line ellipsis slots, so whitespace is collapsed here
 * rather than left to `white-space: nowrap`: a quote spanning three lines then
 * has one canonical rendering instead of one per CSS property.
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function summaryHeadingOf(
  items: readonly SummaryHeadingSource[],
  count: number,
): SummaryHeading {
  const only = items[0]
  // `count` and `items` disagreeing means a caller bug somewhere: show the
  // count wording rather than a quote that contradicts the badge.
  if (count !== 1 || items.length !== 1 || only === undefined) return NONE
  const quote = oneLine(only.title)
  if (quote === '') return NONE
  // "Did the user write a comment?" is comment-block.ts's call, not ours: the
  // empty-string and whitespace-only cases must not drift from the card list,
  // the chip preview and the hand-off panel.
  const block = commentBlockOf(only.comment)
  return { quote, comment: block === null ? null : oneLine(block.text) }
}
