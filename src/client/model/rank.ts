/**
 * Ordered-subsequence ranking ported from the Host's menu primitive.
 *
 * Case-insensitive characters must appear in order; word starts (index 0, or
 * after `-` / `_`) score higher, as does proximity. Prefix matches sort before
 * everything else, and ties keep catalog order.
 */

const NEGATIVE = Number.NEGATIVE_INFINITY

function boundaryBonus(text: string, index: number): number {
  return index === 0 || text.charAt(index - 1) === '-' || text.charAt(index - 1) === '_' ? 8 : 0
}

/** Best subsequence score for one candidate, or undefined when it does not match. */
function score(text: string, query: string): number | undefined {
  if (query.length > text.length) return undefined
  let row: number[] = Array(text.length).fill(NEGATIVE)
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) === query.charAt(0)) row[i] = 1 + boundaryBonus(text, i) - i
  }
  for (let q = 1; q < query.length; q++) {
    const next: number[] = Array(text.length).fill(NEGATIVE)
    let previous = NEGATIVE
    let beforePrevious = NEGATIVE
    let gap = NEGATIVE
    for (let i = 0; i < row.length; i++) {
      const value = row[i] as number
      if (beforePrevious !== NEGATIVE) gap = Math.max(gap, beforePrevious + i - 2)
      if (text.charAt(i) === query.charAt(q)) {
        const bonus = 1 + boundaryBonus(text, i)
        let best = NEGATIVE
        if (previous !== NEGATIVE) best = previous + bonus + 4
        if (gap !== NEGATIVE) best = Math.max(best, gap + bonus + 1 - i)
        next[i] = best
      }
      beforePrevious = previous
      previous = value
    }
    row = next
  }
  let best = NEGATIVE
  for (const value of row) best = Math.max(best, value)
  return best === NEGATIVE ? undefined : best
}

export interface Rankable {
  readonly name: string
  readonly label?: string
}

/** Filter and rank items by an ordered subsequence query; empty query keeps order. */
export function rankByName<T extends Rankable>(items: readonly T[], query: string): T[] {
  const needle = query.toLowerCase()
  if (needle === '') return [...items]
  const scored: Array<{ item: T; index: number; prefix: boolean; score: number }> = []
  items.forEach((item, index) => {
    const candidates = item.label === undefined ? [item.name] : [item.name, item.label]
    let prefix = false
    let best: number | undefined
    for (const candidate of candidates) {
      const text = candidate.toLowerCase()
      const value = score(text, needle)
      if (value === undefined) continue
      prefix ||= text.startsWith(needle)
      best = best === undefined ? value : Math.max(best, value)
    }
    if (best !== undefined) scored.push({ item, index, prefix, score: best })
  })
  scored.sort(
    (left, right) =>
      Number(right.prefix) - Number(left.prefix) ||
      right.score - left.score ||
      left.index - right.index,
  )
  return scored.map((entry) => entry.item)
}
