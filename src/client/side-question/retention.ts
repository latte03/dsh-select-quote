/**
 * Retention for archived side forks.
 *
 * Archiving only hides a fork; the log directory stays on disk forever. The
 * client owns the archive clock (it is the one that closes the tab), the Host
 * owns the only code allowed to unlink files. This module turns the local
 * ledger into a bounded candidate list and then applies the Host's answer.
 *
 * Cleanup is deliberately lossy only for forks this plugin archived itself:
 * the ledger is written after a successful archive, and keeping or opening a
 * fork removes its row before the next run.
 */

import type {
  SideForkPruneRequest,
  SideForkPruneResult,
  SideForkPruneSkipReason,
} from '../../shared/plugin-remote.ts'
import {
  forgetArchivedSideFork,
  isKeptSideFork,
  isKnownSideFork,
  listArchivedSideForks,
  rememberArchivedSideFork,
  type ArchivedSideFork,
} from './fork-state.ts'
import { reuseChildIds } from './reuse-state.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_PRUNE = 512

/** Host methods that mean "this id will not become deletable by retrying". */
const CLEAR_SKIP_REASONS: ReadonlySet<SideForkPruneSkipReason> = new Set([
  'invalid-id',
  'not-archived',
  'missing',
  'not-fork',
  'no-path',
  'unsafe-path',
])

export interface SideForkRetentionApi {
  prune(request: SideForkPruneRequest): Promise<unknown>
}

interface SummaryLike {
  readonly updatedAt?: number
}

export interface SideForkRetentionInput {
  days: number
  api: SideForkRetentionApi
  /** The workspace archive set at the time of the run. */
  archivedIds: readonly string[]
  /** Session summaries, used only to date archives created before this version. */
  summaries: Readonly<Record<string, SummaryLike | undefined>>
  now?: number
}

/**
 * Deterministic candidate selection, separated from storage and transport so
 * every exclusion rule is testable in one place.
 */
export function expiredSideForkIds(input: {
  days: number
  now: number
  entries: readonly ArchivedSideFork[]
  archivedIds: ReadonlySet<string>
  keptIds: ReadonlySet<string>
  reuseIds: ReadonlySet<string>
}): string[] {
  const days = Math.trunc(input.days)
  if (!Number.isFinite(days) || days <= 0) return []
  const cutoff = input.now - days * DAY_MS
  const seen = new Set<string>()
  const ids: string[] = []
  for (const entry of input.entries) {
    if (seen.has(entry.id)) continue
    if (entry.at > cutoff) continue
    if (!input.archivedIds.has(entry.id)) continue
    if (input.keptIds.has(entry.id)) continue
    if (input.reuseIds.has(entry.id)) continue
    seen.add(entry.id)
    ids.push(entry.id)
    if (ids.length >= MAX_PRUNE) break
  }
  return ids
}

/**
 * Give archived forks created before the ledger existed an archive time.
 * `known` is what separates our forks from ordinary sessions the user archived
 * by hand; without it an old manual archive could be picked up as ours.
 */
export function seedArchivedLedger(
  archivedIds: readonly string[],
  summaries: Readonly<Record<string, SummaryLike | undefined>>,
): void {
  const present = new Set(listArchivedSideForks().map(entry => entry.id))
  for (const id of archivedIds) {
    if (present.has(id) || isKeptSideFork(id) || !isKnownSideFork(id)) continue
    const at = summaries[id]?.updatedAt
    if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) continue
    rememberArchivedSideFork(id, at)
    present.add(id)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Accept both a bare result and the Gateway's `{ok, value}` envelope. */
export function unwrapPruneResult(value: unknown): SideForkPruneResult {
  let payload = value
  if (isRecord(payload) && typeof payload.ok === 'boolean') {
    if (!payload.ok) {
      const error = isRecord(payload.error) ? payload.error.message : undefined
      throw new Error(typeof error === 'string' ? error : 'side-fork cleanup failed')
    }
    payload = payload.value
  }
  if (
    !isRecord(payload)
    || !Array.isArray(payload.deleted)
    || !Array.isArray(payload.skipped)
  ) {
    throw new Error('side-fork cleanup returned an invalid result')
  }
  const deleted = payload.deleted.filter((id): id is string => typeof id === 'string')
  const skipped: { id: string; reason: SideForkPruneSkipReason }[] = []
  for (const item of payload.skipped) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.reason !== 'string') {
      continue
    }
    skipped.push({ id: item.id, reason: item.reason as SideForkPruneSkipReason })
  }
  return { deleted, skipped }
}

/**
 * Run one cleanup. Returns the ids the Host actually deleted.
 *
 * The caller may fire this on startup and on a period change; an in-flight run
 * is the caller's to avoid. A Host error propagates without touching the
 * ledger, so the next run retries the same candidates.
 */
export async function runSideForkRetention(
  input: SideForkRetentionInput,
): Promise<readonly string[]> {
  const days = Math.trunc(input.days)
  if (!Number.isFinite(days) || days <= 0) return []
  const now = input.now ?? Date.now()
  if (!Number.isFinite(now) || now <= 0) return []

  seedArchivedLedger(input.archivedIds, input.summaries)
  const entries = listArchivedSideForks()
  const candidates = expiredSideForkIds({
    days,
    now,
    entries,
    archivedIds: new Set(input.archivedIds),
    keptIds: new Set(entries.filter(entry => isKeptSideFork(entry.id)).map(entry => entry.id)),
    reuseIds: new Set(reuseChildIds()),
  })
  if (candidates.length === 0) return []

  const result = unwrapPruneResult(
    await input.api.prune({
      sessionIds: candidates,
      cutoffMs: now - days * DAY_MS,
    }),
  )
  const requested = new Set(candidates)
  for (const id of result.deleted) {
    if (requested.has(id)) forgetArchivedSideFork(id)
  }
  for (const skip of result.skipped) {
    if (requested.has(skip.id) && CLEAR_SKIP_REASONS.has(skip.reason)) {
      forgetArchivedSideFork(skip.id)
    }
  }
  return result.deleted.filter(id => requested.has(id))
}
