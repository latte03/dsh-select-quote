import { describe, expect, it } from 'vitest'
import { userMessageTextOf, type ChatStateLike } from './chat-seat.ts'

const RPC = 'rpc-42'

function state(entries: [string, unknown][]): ChatStateLike {
  return { nodes: { byKey: new Map(entries) } } as unknown as ChatStateLike
}

describe('userMessageTextOf', () => {
  it('resolves the durable node whose source.rpcId matches', () => {
    const value = state([
      [
        'a',
        {
          kind: 'user',
          data: {
            messageId: 'msg-other',
            source: { kind: 'user', rpcId: 'rpc-other' },
            content: [{ type: 'text', text: '别的消息' }],
          },
        },
      ],
      [
        'b',
        {
          kind: 'user',
          data: {
            // messageId differs from the rpc id on purpose: matching on it
            // would resolve nothing.
            messageId: 'msg-42',
            source: { kind: 'user', rpcId: RPC },
            content: [{ type: 'text', text: '正文' }],
          },
        },
      ],
    ])
    expect(userMessageTextOf(value, RPC)).toBe('正文')
  })

  it('ignores non-user nodes even when they carry the same rpc id', () => {
    const value = state([
      ['c', { kind: 'assistant-step', data: { source: { rpcId: RPC }, content: [] } }],
    ])
    expect(userMessageTextOf(value, RPC)).toBeUndefined()
  })

  it('returns undefined for an unknown or missing rpc id', () => {
    const value = state([['a', { kind: 'user', data: { source: { rpcId: RPC }, content: [] } }]])
    expect(userMessageTextOf(value, 'nope')).toBeUndefined()
    expect(userMessageTextOf(value, undefined)).toBeUndefined()
  })

  it('survives a snapshot without nodes.byKey', () => {
    expect(userMessageTextOf({} as ChatStateLike, RPC)).toBeUndefined()
    expect(userMessageTextOf(undefined, RPC)).toBeUndefined()
  })

  it('joins text blocks and skips attachments', () => {
    const value = state([
      [
        'd',
        {
          kind: 'user',
          data: {
            source: { rpcId: 'r1' },
            content: [
              { type: 'text', text: '甲' },
              { type: 'image', attachment: {} },
              { type: 'text', text: '乙' },
            ],
          },
        },
      ],
    ])
    expect(userMessageTextOf(value, 'r1')).toBe('甲乙')
  })
})
