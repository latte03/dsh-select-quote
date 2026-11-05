import { describe, expect, it } from 'vitest'
import { composeAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { createProtocolRule, nextProtocolSpan, PROTOCOL_RULE_ID } from './protocol-rule.ts'

/** Evaluate the rule the way the host's UserTextDocument does: head at each cursor. */
function renderThrough(text: string): string {
  const rule = createProtocolRule()
  let cursor = 0
  let out = ''
  while (cursor < text.length) {
    const node = rule.match(text, cursor, { read: () => undefined })
    if (node === undefined) {
      out += text.slice(cursor)
      break
    }
    if (node.id === 'text') out += node.data.display ?? node.data.text
    else out += text.slice(node.start, node.end)
    cursor = node.end
  }
  return out
}

describe('protocol rule', () => {
  it('hides the whole block so the bubble keeps only the user text', () => {
    const message = composeAnnotatedMessage('这次为什么卡住？', [
      { id: 'a', text: '原文一段', comment: '这里', sources: [{ text: '原文一段' }] },
    ])
    expect(renderThrough(message)).toBe('这次为什么卡住？')
  })

  it('claims header prose together with the payload', () => {
    const message = composeAnnotatedMessage('问题', [
      { id: 'a', text: '选中的句子', sources: [{ text: '选中的句子' }] },
    ])
    const span = nextProtocolSpan(message, 0)
    expect(span).toBeDefined()
    expect(message.slice(span!.start, span!.start + 20)).toBe('# Response annotatio')
    expect(message.slice(span!.end).trim()).toBe('问题')
  })

  it('keeps a selected passage that itself contains the close marker', () => {
    const message = composeAnnotatedMessage('是吗', [
      {
        id: 'a',
        text: '他写了 </response-annotations> 这几个字',
        sources: [{ text: '他写了 </response-annotations> 这几个字' }],
      },
    ])
    expect(renderThrough(message)).toBe('是吗')
  })

  it('still hides a block whose payload is unreadable', () => {
    const message = '# Response annotations:\n\n<response-annotations>\nnot json\n</response-annotations>\n\n问题'
    expect(renderThrough(message).trim()).toBe('问题')
  })

  it('leaves a message without a block untouched', () => {
    expect(renderThrough('普通的一句话')).toBe('普通的一句话')
  })

  it('never claims before the cursor', () => {
    const message = composeAnnotatedMessage('问题', [
      { id: 'a', text: '原文', sources: [{ text: '原文' }] },
    ])
    const body = message.indexOf('问题')
    expect(nextProtocolSpan(message, body)).toBeUndefined()
  })

  it('reports a stable id and a non-reserved order', () => {
    const rule = createProtocolRule()
    expect(rule.id).toBe(PROTOCOL_RULE_ID)
    expect(rule.order).toBeGreaterThan(1010)
  })

  it('produces a text node whose data matches its own slice', () => {
    const message = composeAnnotatedMessage('问题', [
      { id: 'a', text: '原文', sources: [{ text: '原文' }] },
    ])
    const node = createProtocolRule().match(message, 0, { read: () => undefined })
    expect(node?.id).toBe('text')
    expect(node?.data.text).toBe(message.slice(node!.start, node!.end))
  })
})
