import { describe, expect, it } from 'vitest'
import { summaryHeadingOf, type SummaryHeadingSource } from './summary-heading.ts'

const quote: SummaryHeadingSource = { title: '四件事都做完了' }

describe('summaryHeadingOf', () => {
  it('reports the quote as the title when a single annotation stands alone', () => {
    expect(summaryHeadingOf([quote], 1)).toEqual({ quote: '四件事都做完了', comment: null })
  })

  it('adds the comment as the hint when the user wrote one', () => {
    expect(summaryHeadingOf([{ ...quote, comment: '这句要改' }], 1)).toEqual({
      quote: '四件事都做完了',
      comment: '这句要改',
    })
  })

  it('leaves the hint out for an empty or blank comment', () => {
    expect(summaryHeadingOf([{ ...quote, comment: '' }], 1).comment).toBeNull()
    expect(summaryHeadingOf([{ ...quote, comment: '  \n\t ' }], 1).comment).toBeNull()
  })

  it('collapses whitespace so both slots are one line', () => {
    const heading = summaryHeadingOf(
      [{ title: '  第一行\n  第二行  ', comment: '  先\n看这里  ' }],
      1,
    )
    expect(heading).toEqual({ quote: '第一行 第二行', comment: '先 看这里' })
  })

  it('keeps the count wording from two annotations up', () => {
    expect(summaryHeadingOf([quote, quote], 2)).toEqual({ quote: null, comment: null })
    expect(summaryHeadingOf([quote], 3)).toEqual({ quote: null, comment: null })
  })

  it('falls back when the single quote is blank', () => {
    expect(summaryHeadingOf([{ title: ' \n ', comment: '有评论' }], 1)).toEqual({
      quote: null,
      comment: null,
    })
  })

  it('falls back when the caller has the count but no items', () => {
    expect(summaryHeadingOf([], 1)).toEqual({ quote: null, comment: null })
    expect(summaryHeadingOf([], 0)).toEqual({ quote: null, comment: null })
  })
})
