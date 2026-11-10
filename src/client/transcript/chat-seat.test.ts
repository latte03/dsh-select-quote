import { describe, expect, it } from 'vitest'
import {
  chatTurnOpenOf,
  sessionRunningOf,
  type ChatNodeLike,
  type ChatStateLike,
  type SessionStatusLike,
} from './chat-seat.ts'

function stateOf(entries: [string, ChatNodeLike][]): ChatStateLike {
  return { nodes: { byKey: new Map(entries) } }
}

const userRow = (rpcId: string, status?: string): ChatNodeLike => ({
  kind: 'user',
  data: { source: { kind: 'user', rpcId } },
  ...(status === undefined ? {} : { location: { kind: 'turn', turn: { status } } }),
})

describe('chatTurnOpenOf', () => {
  it('reports the turn as open while the Host says so', () => {
    expect(chatTurnOpenOf(stateOf([['a', userRow('r1', 'open')]]), 'r1')).toBe(true)
  })

  it('reports the turn as closed once it ends', () => {
    expect(chatTurnOpenOf(stateOf([['a', userRow('r1', 'closed')]]), 'r1')).toBe(false)
  })

  it('says "unknown" rather than guessing', () => {
    // No location, no node, or no rpcId: every one of them has to be undefined,
    // because the whale treats a guess as a reason to swim forever.
    expect(chatTurnOpenOf(stateOf([['a', userRow('r1')]]), 'r1')).toBeUndefined()
    expect(chatTurnOpenOf(stateOf([['a', userRow('r1', 'open')]]), 'other')).toBeUndefined()
    expect(chatTurnOpenOf(stateOf([['a', userRow('r1', 'open')]]), undefined)).toBeUndefined()
    expect(chatTurnOpenOf(undefined, 'r1')).toBeUndefined()
    expect(chatTurnOpenOf({}, 'r1')).toBeUndefined()
  })

  it('reads each row separately so parallel turns cannot borrow a run', () => {
    const state = stateOf([
      ['a', userRow('r1', 'closed')],
      ['b', userRow('r2', 'open')],
    ])
    expect(chatTurnOpenOf(state, 'r1')).toBe(false)
    expect(chatTurnOpenOf(state, 'r2')).toBe(true)
  })
})

describe('sessionRunningOf', () => {
  const snapshot = new Map<string, SessionStatusLike>([
    ['s1', { running: true }],
    ['s2', { running: false }],
  ])

  it('reads the running flag for one session', () => {
    expect(sessionRunningOf(snapshot, 's1')).toBe(true)
    expect(sessionRunningOf(snapshot, 's2')).toBe(false)
  })

  it('is undefined when the session or the snapshot is missing', () => {
    expect(sessionRunningOf(snapshot, 's3')).toBeUndefined()
    expect(sessionRunningOf(snapshot, undefined)).toBeUndefined()
    expect(sessionRunningOf(undefined, 's1')).toBeUndefined()
  })
})
