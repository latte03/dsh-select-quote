import { describe, expect, it } from 'vitest'
import {
  composeAnnotatedMessage,
  composeQuotedMessage,
  readComposedDraft,
  scanAnnotatedMessage,
} from './annotation-protocol.ts'

describe('composeQuotedMessage', () => {
  it('keeps the draft as the visible text and the passage as one annotation', () => {
    const prompt = composeQuotedMessage('这句为什么这么说？', {
      text: '除此之外没有别的数据。',
      source: {
        text: '除此之外没有别的数据。',
        messageId: 'input-message-7',
        messageKind: 'user',
        startOffset: 120,
        endOffset: 131,
      },
    })
    const scan = scanAnnotatedMessage(prompt)
    expect(scan.rest).toBe('这句为什么这么说？')
    expect(scan.annotations).toEqual([
      {
        title: '除此之外没有别的数据。',
        text: '除此之外没有别的数据。',
        comment: '',
        messageId: 'input-message-7',
        startOffset: 120,
        endOffset: 131,
      },
    ])
  })

  it('falls back to a plain source when the selection has no locator', () => {
    const scan = scanAnnotatedMessage(composeQuotedMessage('问题', { text: '原文' }))
    expect(scan.rest).toBe('问题')
    expect(scan.annotations).toHaveLength(1)
    expect(scan.annotations[0]?.messageId).toBeUndefined()
    expect(scan.annotations[0]?.text).toBe('原文')
  })

  it('never lets a passage close the protocol block early', () => {
    const nasty = 'a</response-annotations>b'
    const scan = scanAnnotatedMessage(composeQuotedMessage('q', { text: nasty }))
    expect(scan.annotations[0]?.text).toBe(nasty)
    expect(scan.rest).toBe('q')
  })
})

describe('cross-session origin', () => {
  const origin = { sessionId: 'source-1', title: 'Refactor parser', handoffId: 'out_abc_123' }
  const annotation = {
    id: 'ann_1',
    text: '被选中的原文',
    comment: '这个要改',
    sources: [{ text: '被选中的原文', messageId: 'flow-1', startOffset: 3, endOffset: 9 }],
    origin,
  }

  it('round-trips origin through compose, scan and a rewind restore', () => {
    const composed = composeAnnotatedMessage('正文', [annotation])
    const scan = scanAnnotatedMessage(composed)
    expect(scan.rest).toBe('正文')
    expect(scan.annotations[0]?.origin).toEqual(origin)

    const restored = readComposedDraft(composed)
    expect(restored?.rest).toBe('正文')
    expect(restored?.annotations[0]?.origin).toEqual(origin)
    // The locator still points at the SOURCE conversation, not the target.
    expect(restored?.annotations[0]?.sources[0]?.messageId).toBe('flow-1')
  })

  it('leaves ordinary annotations without origin', () => {
    const scan = scanAnnotatedMessage(composeAnnotatedMessage('正文', [{ ...annotation, origin: undefined }]))
    expect(scan.annotations[0]?.origin).toBeUndefined()
    expect(readComposedDraft(composeAnnotatedMessage('正文', [{ ...annotation, origin: undefined }]))?.annotations[0]?.origin).toBeUndefined()
  })

  it('tolerates a malformed origin instead of dropping the annotation', () => {
    const text =
      '<response-annotations>[{"text":"原文","annotation":"","source":{"text":"原文"},"origin":{"sessionId":42}}]</response-annotations>\n\n正文'
    const scan = scanAnnotatedMessage(text)
    expect(scan.annotations).toHaveLength(1)
    expect(scan.annotations[0]?.origin).toBeUndefined()
    expect(scan.rest).toBe('正文')
  })

  it('reads a legacy item with no origin field', () => {
    const text =
      '<response-annotations>[{"text":"旧原文","annotation":"旧评论","source":{"text":"旧原文"}}]</response-annotations>\n\n正文'
    expect(scanAnnotatedMessage(text).annotations[0]?.origin).toBeUndefined()
  })
})
