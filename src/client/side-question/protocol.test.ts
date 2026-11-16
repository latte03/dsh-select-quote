import { describe, expect, it } from 'vitest'
import { parseSideForkAddress, sideForkAddress, sideForkSessionIdOfTab } from './protocol.ts'

describe('side-fork address', () => {
  it('round-trips a session id, including characters the URL encodes', () => {
    for (const id of ['session-a', 'session-a b', 'session/斜杠']) {
      expect(parseSideForkAddress(sideForkAddress(id))).toBe(id)
    }
  })

  it('rejects another protocol, host, or path shape', () => {
    expect(parseSideForkAddress('dsh-resource://subagentchat/session/session-a')).toBeUndefined()
    expect(parseSideForkAddress('dsh-resource://select-quote-side/other/session-a')).toBeUndefined()
    expect(parseSideForkAddress('dsh-resource://select-quote-side/session/a/b')).toBeUndefined()
    expect(parseSideForkAddress('not a url')).toBeUndefined()
  })

  it('reads a session id only from a tab of this kind', () => {
    const address = sideForkAddress('session-a')
    expect(sideForkSessionIdOfTab({ kind: 'select-quote-side', contentId: address })).toBe('session-a')
    expect(sideForkSessionIdOfTab({ kind: 'terminal', contentId: address })).toBeUndefined()
    expect(sideForkSessionIdOfTab({ kind: 'select-quote-side', contentId: 'not a url' })).toBeUndefined()
  })
})
