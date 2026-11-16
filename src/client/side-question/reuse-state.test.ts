import { describe, expect, it } from 'vitest'
import {
  loadReuseEntries,
  lookupReuseChild,
  normalizeReuseEntries,
  removeReuseEntry,
  saveReuseEntries,
  setReuseEntry,
} from './reuse-state.ts'

const entry = (parentId: string, childId: string) => ({ parentId, childId })

describe('reuse entries', () => {
  it('drops malformed rows and duplicate parents, keeping the newest', () => {
    expect(normalizeReuseEntries(null)).toEqual([])
    expect(normalizeReuseEntries('session-a')).toEqual([])
    expect(
      normalizeReuseEntries([
        entry('session-a', 'child-1'),
        entry('session-a', 'child-2'),
        { parentId: 'session-b' },
        { parentId: 7, childId: 'child-3' },
        entry('', 'child-4'),
      ]),
    ).toEqual([entry('session-a', 'child-2')])
  })

  it('keeps at most the newest parents', () => {
    const rows = Array.from({ length: 70 }, (_, index) =>
      entry(`session-${index}`, `child-${index}`))
    const normalized = normalizeReuseEntries(rows)
    expect(normalized).toHaveLength(64)
    expect(normalized[0]?.parentId).toBe('session-6')
    expect(normalized.at(-1)?.parentId).toBe('session-69')
  })

  it('moves an existing parent to the end and removes by parent', () => {
    const rows = [entry('session-a', 'child-1'), entry('session-b', 'child-2')]
    expect(setReuseEntry(rows, 'session-a', 'child-3')).toEqual([
      entry('session-b', 'child-2'),
      entry('session-a', 'child-3'),
    ])
    expect(removeReuseEntry(rows, 'session-a')).toEqual([entry('session-b', 'child-2')])
    expect(lookupReuseChild(rows, 'session-b')).toBe('child-2')
    expect(lookupReuseChild(rows, 'session-missing')).toBeUndefined()
  })

  it('reads and writes through a storage face', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => { values.set(key, value) },
    }
    saveReuseEntries(storage, [entry('session-a', 'child-1')])
    expect(loadReuseEntries(storage)).toEqual([entry('session-a', 'child-1')])
  })
})
