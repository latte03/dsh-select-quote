/**
 * Catalog state for side-question forks.
 *
 * A side question is an ordinary Session fork, so keeping it out of the left
 * catalog is presentation: remember its id, mark the row through the public
 * `sidebar.session.row.trailing` seat, and let the host CSS hide the marked
 * row. Keeping a fork drops the marker and survives tab close as a normal
 * listed Session. The known set separates side forks from ordinary Sessions,
 * so an embedded side chat never takes over the main annotation binding.
 */

const HIDDEN_KEY = 'dsh-select-quote.side-question.hidden.v1'
const KNOWN_KEY = 'dsh-select-quote.side-question.known.v1'
const KEPT_KEY = 'dsh-select-quote.side-question.kept.v1'
const ARCHIVED_KEY = 'dsh-select-quote.side-question.archived.v1'
const MAX_IDS = 64
const MAX_ARCHIVED = 512
const MAX_ID_LENGTH = 128

type SideForkStorage = Pick<Storage, 'getItem' | 'setItem'>

/** One fork we archived on tab close, with the archive time cleanup counts from. */
export interface ArchivedSideFork {
  readonly id: string
  readonly at: number
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function sameArchived(
  left: readonly ArchivedSideFork[],
  right: readonly ArchivedSideFork[],
): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry.id === right[index]?.id && entry.at === right[index]?.at)
}

/** Validate one stored JSON value; malformed members and duplicates are dropped. */
export function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of value) {
    if (!isSessionId(item) || seen.has(item)) continue
    seen.add(item)
    ids.push(item)
  }
  return ids.slice(-MAX_IDS)
}

/** Add one id at the end, dropping an older copy and the oldest overflow. */
export function addId(ids: readonly string[], id: string): string[] {
  if (!isSessionId(id)) return [...ids]
  return [...ids.filter(value => value !== id), id].slice(-MAX_IDS)
}

export function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter(value => value !== id)
}

/** Validate one stored ledger; malformed rows and duplicate ids are dropped. */
export function normalizeArchivedSideForks(value: unknown): ArchivedSideFork[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, ArchivedSideFork>()
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const id = record.id
    const at = record.at
    if (!isSessionId(id) || !isTimestamp(at)) continue
    byId.delete(id)
    byId.set(id, { id, at })
  }
  return [...byId.values()].slice(-MAX_ARCHIVED)
}

export function setArchivedEntry(
  entries: readonly ArchivedSideFork[],
  id: string,
  at: number,
): ArchivedSideFork[] {
  if (!isSessionId(id) || !isTimestamp(at)) return [...entries]
  return [
    ...entries.filter(entry => entry.id !== id),
    { id, at },
  ].slice(-MAX_ARCHIVED)
}

export function removeArchivedEntry(
  entries: readonly ArchivedSideFork[],
  id: string,
): ArchivedSideFork[] {
  return entries.filter(entry => entry.id !== id)
}

export function lookupArchivedEntry(
  entries: readonly ArchivedSideFork[],
  id: string,
): ArchivedSideFork | undefined {
  return entries.find(entry => entry.id === id)
}

export function loadIds(source: Pick<SideForkStorage, 'getItem'> | undefined, key: string): string[] {
  if (source === undefined) return []
  try {
    return normalizeIds(JSON.parse(source.getItem(key) ?? '[]') as unknown)
  } catch {
    return []
  }
}

export function saveIds(
  target: Pick<SideForkStorage, 'setItem'> | undefined,
  key: string,
  ids: readonly string[],
): void {
  if (target === undefined) return
  try {
    target.setItem(key, JSON.stringify(ids))
  } catch {}
}

function loadArchived(
  source: Pick<SideForkStorage, 'getItem'> | undefined,
): ArchivedSideFork[] {
  if (source === undefined) return []
  try {
    return normalizeArchivedSideForks(
      JSON.parse(source.getItem(ARCHIVED_KEY) ?? '[]') as unknown,
    )
  } catch {
    return []
  }
}

function saveArchived(
  target: Pick<SideForkStorage, 'setItem'> | undefined,
  entries: readonly ArchivedSideFork[],
): void {
  if (target === undefined) return
  try {
    target.setItem(ARCHIVED_KEY, JSON.stringify(entries))
  } catch {}
}

function defaultStorage(): SideForkStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const storage = defaultStorage()
let hiddenIds = loadIds(storage, HIDDEN_KEY)
let knownIds = loadIds(storage, KNOWN_KEY)
let keptIds = loadIds(storage, KEPT_KEY)
let archivedForks = loadArchived(storage)
let version = 0
const listeners = new Set<() => void>()

function publish(): void {
  version += 1
  for (const listener of [...listeners]) listener()
}

export function getSideForkStateVersion(): number {
  return version
}

function setHidden(next: string[]): boolean {
  if (sameIds(next, hiddenIds)) return false
  hiddenIds = next
  saveIds(storage, HIDDEN_KEY, hiddenIds)
  return true
}

function setKnown(next: string[]): boolean {
  if (sameIds(next, knownIds)) return false
  knownIds = next
  saveIds(storage, KNOWN_KEY, knownIds)
  return true
}

function setKept(next: string[]): boolean {
  if (sameIds(next, keptIds)) return false
  keptIds = next
  saveIds(storage, KEPT_KEY, keptIds)
  return true
}

function setArchived(next: ArchivedSideFork[]): boolean {
  if (sameArchived(next, archivedForks)) return false
  archivedForks = next
  saveArchived(storage, archivedForks)
  return true
}

export function isHiddenSideFork(id: string): boolean {
  return hiddenIds.includes(id)
}

export function isKnownSideFork(id: string): boolean {
  return knownIds.includes(id)
}

export function isKeptSideFork(id: string): boolean {
  return keptIds.includes(id)
}

/** Every fork we archived ourselves, oldest archive first. */
export function listArchivedSideForks(): readonly ArchivedSideFork[] {
  return archivedForks
}

export function hasArchivedSideFork(id: string): boolean {
  return lookupArchivedEntry(archivedForks, id) !== undefined
}

/** Record one successful archive; cleanup measures the retention period from here. */
export function rememberArchivedSideFork(id: string, at: number = Date.now()): void {
  if (!isSessionId(id) || !isTimestamp(at)) return
  if (setArchived(setArchivedEntry(archivedForks, id, at))) publish()
}

export function forgetArchivedSideFork(id: string): void {
  if (setArchived(removeArchivedEntry(archivedForks, id))) publish()
}

/** Hide a newly created (or reused) side fork and remember it as ours. */
export function rememberSideFork(id: string): void {
  if (!isSessionId(id)) return
  const hidden = setHidden(addId(hiddenIds, id))
  const known = setKnown(addId(knownIds, id))
  if (hidden || known) publish()
}

export function forgetHiddenSideFork(id: string): void {
  if (setHidden(removeId(hiddenIds, id))) publish()
}

/** Keep a fork as a normal listed Session; its tab close no longer archives it. */
export function keepSideFork(id: string): void {
  if (!isSessionId(id)) return
  const hidden = setHidden(removeId(hiddenIds, id))
  const kept = setKept(addId(keptIds, id))
  const known = setKnown(addId(knownIds, id))
  const archived = setArchived(removeArchivedEntry(archivedForks, id))
  if (hidden || kept || known || archived) publish()
}

/** Drop every trace of a fork that no longer exists. */
export function forgetSideFork(id: string): void {
  const hidden = setHidden(removeId(hiddenIds, id))
  const kept = setKept(removeId(keptIds, id))
  const known = setKnown(removeId(knownIds, id))
  const archived = setArchived(removeArchivedEntry(archivedForks, id))
  if (hidden || kept || known || archived) publish()
}

export function subscribeSideForkState(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
