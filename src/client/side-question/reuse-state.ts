/**
 * Parent → side-fork map for reuse mode.
 *
 * Reuse keeps one side conversation per main Session. The child is an ordinary
 * fork now, so its id has to be remembered locally; the Host no longer derives
 * a deterministic subagent id. A stale child is replaced on the next question.
 */

const STORAGE_KEY = 'dsh-select-quote.side-question.reuse.v1'
const MAX_ENTRIES = 64
const MAX_ID_LENGTH = 128

type ReuseStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface ReuseEntry {
  readonly parentId: string
  readonly childId: string
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

/** Validate one stored JSON value; malformed rows and duplicate parents are dropped. */
export function normalizeReuseEntries(value: unknown): ReuseEntry[] {
  if (!Array.isArray(value)) return []
  const byParent = new Map<string, ReuseEntry>()
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const parentId = record.parentId
    const childId = record.childId
    if (!isSessionId(parentId) || !isSessionId(childId)) continue
    byParent.delete(parentId)
    byParent.set(parentId, { parentId, childId })
  }
  return [...byParent.values()].slice(-MAX_ENTRIES)
}

export function setReuseEntry(
  entries: readonly ReuseEntry[],
  parentId: string,
  childId: string,
): ReuseEntry[] {
  if (!isSessionId(parentId) || !isSessionId(childId)) return [...entries]
  return [
    ...entries.filter(entry => entry.parentId !== parentId),
    { parentId, childId },
  ].slice(-MAX_ENTRIES)
}

export function removeReuseEntry(entries: readonly ReuseEntry[], parentId: string): ReuseEntry[] {
  return entries.filter(entry => entry.parentId !== parentId)
}

export function lookupReuseChild(
  entries: readonly ReuseEntry[],
  parentId: string,
): string | undefined {
  return entries.find(entry => entry.parentId === parentId)?.childId
}

export function loadReuseEntries(
  source: Pick<ReuseStorage, 'getItem'> | undefined,
): ReuseEntry[] {
  if (source === undefined) return []
  try {
    return normalizeReuseEntries(JSON.parse(source.getItem(STORAGE_KEY) ?? '[]') as unknown)
  } catch {
    return []
  }
}

export function saveReuseEntries(
  target: Pick<ReuseStorage, 'setItem'> | undefined,
  entries: readonly ReuseEntry[],
): void {
  if (target === undefined) return
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

function defaultStorage(): ReuseStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const storage = defaultStorage()
let entries = loadReuseEntries(storage)

export function reusableForkFor(parentId: string): string | undefined {
  return lookupReuseChild(entries, parentId)
}

export function rememberReusableFork(parentId: string, childId: string): void {
  const next = setReuseEntry(entries, parentId, childId)
  if (next.length === entries.length && next.every((entry, index) => entry === entries[index])) return
  entries = next
  saveReuseEntries(storage, entries)
}

export function forgetReusableFork(parentId: string): void {
  const next = removeReuseEntry(entries, parentId)
  if (next.length === entries.length) return
  entries = next
  saveReuseEntries(storage, entries)
}
