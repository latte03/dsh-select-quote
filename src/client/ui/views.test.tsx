import { beforeAll, describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bindTestLocale } from '../i18n.testkit.ts'
import { AnnotationSummary, SummaryComment, type AnnotationSummaryItem } from './AnnotationCardView.tsx'
import { KBD_GLYPH, Kbd } from './Kbd.tsx'

/**
 * Structural smoke tests for the React surfaces.
 *
 * These render to a string — no jsdom, no layout, no effects — which is exactly
 * the scope they claim: a component that throws on a missing prop, drops a
 * label, inverts a conditional or prints an unresolved i18n key fails here.
 * Anything that needs geometry, the CSS cascade or the host DOM stays with the
 * real-client pass; see docs/internals.md for why that split is deliberate.
 */

beforeAll(() => {
  bindTestLocale('zh')
})

/**
 * The card pins its panel with `useLayoutEffect`, which has no server pass, so
 * React logs a warning that says nothing about this test's claims. Swallow that
 * one line and let every other warning through.
 */
function renderQuiet(element: ReactElement): string {
  const original = console.error
  console.error = (...args: unknown[]): void => {
    const first = args[0]
    if (typeof first === 'string' && first.includes('useLayoutEffect does nothing on the server')) {
      return
    }
    original(...args)
  }
  try {
    return renderToStaticMarkup(element)
  } finally {
    console.error = original
  }
}

const item = (comment?: string): AnnotationSummaryItem => ({
  id: 'a',
  title: '四件事都做完了',
  text: '四件事都做完了，已提交并推送',
  comment,
})

describe('AnnotationSummary', () => {
  it('titles a lone annotation with its quote instead of a count', () => {
    const html = renderQuiet(<AnnotationSummary count={1} items={[item()]} />)
    expect(html).toContain('data-selection-annotation-summary="true"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('四件事都做完了')
    // One annotation is not a list: there is nothing left to count, and the
    // affordance copy would only repeat what the badge already shows.
    expect(html).not.toContain('1 条批注')
    expect(html).not.toContain('悬停查看批注')
    expect(html).not.toContain('点按查看批注')
    // The hover panel is portal-only: nothing from the list may leak into the
    // collapsed render, or the page shows duplicate quote text.
    expect(html).not.toContain('四件事都做完了，已提交并推送')
  })

  it('adds the comment under the quote when the user wrote one', () => {
    const html = renderQuiet(<AnnotationSummary count={1} items={[item('这句要改')]} />)
    expect(html).toContain('四件事都做完了')
    expect(html).toContain('这句要改')
    expect(html).not.toContain('悬停查看批注')
  })

  it('draws no hint line at all when the lone annotation has no comment', () => {
    // Not "an empty hint": the element is gone, so the card is one line tall.
    const html = renderQuiet(<AnnotationSummary count={1} items={[item()]} />)
    expect(html).not.toContain('dsq_summaryHint')
  })

  it('offers the remove-all button only when a handler is given', () => {
    const plain = renderQuiet(<AnnotationSummary count={1} items={[item()]} />)
    const removable = renderQuiet(
      <AnnotationSummary count={1} items={[item()]} onRemoveAll={() => {}} />,
    )
    expect(plain).not.toContain('移除全部划词批注')
    expect(removable).toContain('移除全部划词批注')
  })

  it('keeps the count and the hover wording from two annotations up', () => {
    const html = renderQuiet(
      <AnnotationSummary count={3} items={[item(), item(), item()]} />,
    )
    expect(html).toContain('3 条批注')
    expect(html).toContain('悬停查看批注')
    expect(html).not.toContain('四件事都做完了')
  })
})

describe('SummaryComment', () => {
  it('draws nothing when the user wrote no comment', () => {
    expect(renderQuiet(<SummaryComment />)).toBe('')
    expect(renderQuiet(<SummaryComment comment="" />)).toBe('')
    expect(renderQuiet(<SummaryComment comment="   " />)).toBe('')
  })

  it('draws the label and the text when there is one', () => {
    const html = renderQuiet(<SummaryComment comment="这条有评论" />)
    expect(html).toContain('用户评论')
    expect(html).toContain('这条有评论')
  })
})

describe('Kbd', () => {
  it('paints one glyph, hidden from assistive tech', () => {
    const html = renderQuiet(<Kbd />)
    expect(html).toContain(KBD_GLYPH)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<kbd')
  })
})
