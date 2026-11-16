import { describe, expect, it } from 'vitest'
import {
  addId,
  forgetArchivedSideFork,
  forgetSideFork,
  hasArchivedSideFork,
  isHiddenSideFork,
  isKeptSideFork,
  isKnownSideFork,
  keepSideFork,
  listArchivedSideForks,
  loadIds,
  normalizeArchivedSideForks,
  normalizeIds,
  rememberArchivedSideFork,
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

describe('archived side-fork ledger', () => {
  it('drops malformed rows and keeps the last duplicate', () => {
    expect(normalizeArchivedSideForks(null)).toEqual([])
    expect(normalizeArchivedSideForks('session-a')).toEqual([])
    expect(
      normalizeArchivedSideForks([
        { id: 'session-a', at: 1 },
        { id: 'session-a', at: 2 },
        { id: 'session-b', at: Number.NaN },
        { id: '', at: 3 },
        { id: 'session-c', at: 4 },
      ]),
    ).toEqual([
      { id: 'session-a', at: 2 },
      { id: 'session-c', at: 4 },
    ])
  })

  it('tracks an archive until the fork is opened, kept, or forgotten', () => {
    const remembered = 'session-ledger-remember'
    const kept = 'session-ledger-kept'
    const forgotten = 'session-ledger-forgotten'
    try {
      rememberSideFork(remembered)
      rememberArchivedSideFork(remembered, 1_700_000_000_000)
      expect(hasArchivedSideFork(remembered)).toBe(true)
      expect(listArchivedSideForks()).toContainEqual({
        id: remembered,
        at: 1_700_000_000_000,
      })

      forgetArchivedSideFork(remembered)
      expect(hasArchivedSideFork(remembered)).toBe(false)

      rememberArchivedSideFork(remembered, 1_700_000_000_001)
      keepSideFork(remembered)
      expect(hasArchivedSideFork(remembered)).toBe(false)

      rememberSideFork(kept)
      rememberArchivedSideFork(kept, 1_700_000_000_002)
      forgetSideFork(kept)
      expect(hasArchivedSideFork(kept)).toBe(false)

      rememberSideFork(forgotten)
      rememberArchivedSideFork(forgotten, 1_700_000_000_003)
      forgetSideFork(forgotten)
      expect(hasArchivedSideFork(forgotten)).toBe(false)
    } finally {
      forgetSideFork(remembered)
      forgetSideFork(kept)
      forgetSideFork(forgotten)
    }
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
