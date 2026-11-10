import { describe, expect, it } from 'vitest'
import { commentBlockOf } from './comment-block.ts'

describe('commentBlockOf', () => {
  it('shows nothing when there is no comment field at all', () => {
    expect(commentBlockOf(null)).toBeNull()
    expect(commentBlockOf(undefined)).toBeNull()
  })

  it('shows nothing for an empty or whitespace-only comment', () => {
    expect(commentBlockOf('')).toBeNull()
    expect(commentBlockOf('   ')).toBeNull()
    expect(commentBlockOf('\n\t ')).toBeNull()
  })

  it('shows the comment as written', () => {
    expect(commentBlockOf('这条有评论')).toEqual({ text: '这条有评论' })
  })

  it('trims the edges but keeps inner line breaks', () => {
    expect(commentBlockOf('  first\nsecond  ')).toEqual({ text: 'first\nsecond' })
  })
})
