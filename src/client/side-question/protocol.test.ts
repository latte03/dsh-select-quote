import { describe, expect, it } from 'vitest'
import { parseSideForkAddress, sideForkAddress } from './protocol.ts'

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
})
