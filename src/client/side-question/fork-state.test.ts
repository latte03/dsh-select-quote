import { describe, expect, it } from 'vitest'
import {
  addId,
  forgetSideFork,
  isHiddenSideFork,
  isKeptSideFork,
  isKnownSideFork,
  keepSideFork,
  loadIds,
  normalizeIds,
  rememberSideFork,
  removeId,
  saveIds,
  subscribeSideForkState,
} from './fork-state.ts'

describe('side-fork id storage', () => {
  it('drops malformed members and duplicates', () => {
    expect(normalizeIds(null)).toEqual([])
    expect(normalizeIds('session-a')).toEqual([])
    expect(normalizeIds(['session-a', 'session-a', 7, '', 'session-b']))
      .toEqual(['session-a', 'session-b'])
  })

  it('keeps at most the newest ids', () => {
    const ids = Array.from({ length: 70 }, (_, index) => `session-${index}`)
    const normalized = normalizeIds(ids)
    expect(normalized).toHaveLength(64)
    expect(normalized[0]).toBe('session-6')
    expect(normalized.at(-1)).toBe('session-69')
  })

  it('moves an existing id to the end and removes by id', () => {
    expect(addId(['session-a', 'session-b'], 'session-a'))
      .toEqual(['session-b', 'session-a'])
    expect(addId(['session-a'], 'session-b'))
      .toEqual(['session-a', 'session-b'])
    expect(removeId(['session-a', 'session-b'], 'session-a'))
      .toEqual(['session-b'])
  })

  it('reads and writes through a storage face', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => { values.set(key, value) },
    }
    saveIds(storage, 'test-key', ['session-a', 'session-b'])
    expect(loadIds(storage, 'test-key')).toEqual(['session-a', 'session-b'])
  })
})

describe('side-fork state', () => {
  it('remembers, keeps, and forgets one fork', () => {
    const remembered = 'session-state-remember'
    let notified = 0
    const unsubscribe = subscribeSideForkState(() => { notified += 1 })
    try {
      rememberSideFork(remembered)
      expect(isHiddenSideFork(remembered)).toBe(true)
      expect(isKnownSideFork(remembered)).toBe(true)
      expect(isKeptSideFork(remembered)).toBe(false)

      keepSideFork(remembered)
      expect(isHiddenSideFork(remembered)).toBe(false)
      expect(isKnownSideFork(remembered)).toBe(true)
      expect(isKeptSideFork(remembered)).toBe(true)

      forgetSideFork(remembered)
      expect(isHiddenSideFork(remembered)).toBe(false)
      expect(isKnownSideFork(remembered)).toBe(false)
      expect(isKeptSideFork(remembered)).toBe(false)
      expect(notified).toBeGreaterThanOrEqual(3)
    } finally {
      unsubscribe()
      forgetSideFork(remembered)
    }
  })
})
