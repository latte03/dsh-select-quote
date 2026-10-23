import { describe, expect, it } from 'vitest'
import { linkTarget, selectionUrl } from './selection-url.ts'

describe('selectionUrl', () => {
  it('accepts http(s) URLs with a sizeable amount of drag punctuation', () => {
    expect(selectionUrl('  https://example.com/a?b=1  ')).toBe('https://example.com/a?b=1')
    expect(selectionUrl('（https://example.com/path）。')).toBe('https://example.com/path')
    expect(selectionUrl('"http://example.com"')).toBe('http://example.com/')
  })

  it('rejects prose, whitespace, and non-http schemes', () => {
    expect(selectionUrl('see https://example.com')).toBeNull()
    expect(selectionUrl('https://example.com/a b')).toBeNull()
    expect(selectionUrl('mailto:hello@example.com')).toBeNull()
    expect(selectionUrl('javascript:alert(1)')).toBeNull()
    expect(selectionUrl('')).toBeNull()
  })
})

describe('linkTarget', () => {
  it('prefers the selected URL over the anchor', () => {
    expect(linkTarget('https://selected.example', 'https://anchor.example')).toBe(
      'https://selected.example/',
    )
  })

  it('falls back to the anchor when the selection is wording', () => {
    expect(linkTarget('点击这里', 'https://anchor.example')).toBe('https://anchor.example/')
    expect(linkTarget('点击这里', 'javascript:alert(1)')).toBeNull()
    expect(linkTarget('点击这里')).toBeNull()
  })
})
