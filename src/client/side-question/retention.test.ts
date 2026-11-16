import { afterEach, describe, expect, it } from 'vitest'
import {
  forgetArchivedSideFork,
  forgetSideFork,
  hasArchivedSideFork,
  keepSideFork,
  listArchivedSideForks,
  rememberArchivedSideFork,
  rememberSideFork,
} from './fork-state.ts'
import {
  expiredSideForkIds,
  runSideForkRetention,
  seedArchivedLedger,
  unwrapPruneResult,
} from './retention.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const touched = new Set<string>()

afterEach(() => {
  for (const id of touched) forgetSideFork(id)
  touched.clear()
})

describe('expiredSideForkIds', () => {
  const entries = [
    { id: 'old', at: NOW - 40 * DAY },
    { id: 'recent', at: NOW - 2 * DAY },
    { id: 'kept', at: NOW - 40 * DAY },
    { id: 'reuse', at: NOW - 40 * DAY },
    { id: 'open', at: NOW - 40 * DAY },
  ]
  const base = {
    days: 30,
    now: NOW,
    entries,
    archivedIds: new Set(['old', 'recent', 'kept', 'reuse']),
    keptIds: new Set(['kept']),
    reuseIds: new Set(['reuse']),
  }

  it('selects only old, archived, unkept, non-reused forks', () => {
    expect(expiredSideForkIds(base)).toEqual(['old'])
  })

  it('does nothing when the period is off', () => {
    expect(expiredSideForkIds({ ...base, days: 0 })).toEqual([])
    expect(expiredSideForkIds({ ...base, days: -1 })).toEqual([])
    expect(expiredSideForkIds({ ...base, days: Number.NaN })).toEqual([])
  })

  it('skips ledger rows that are no longer archived', () => {
    expect(
      expiredSideForkIds({ ...base, archivedIds: new Set(['recent']) }),
    ).toEqual([])
  })
})

describe('seedArchivedLedger', () => {
  it('dates archives made before the ledger existed, but only ours', () => {
    const ours = 'session-retention-seed-ours'
    const manual = 'session-retention-seed-manual'
    touched.add(ours)
    touched.add(manual)
    rememberSideFork(ours)
    rememberSideFork(manual)
    keepSideFork(manual)

    seedArchivedLedger(
      [ours, manual, 'session-retention-seed-unknown'],
      {
        [ours]: { updatedAt: NOW - 31 * DAY },
        [manual]: { updatedAt: NOW - 31 * DAY },
      },
    )

    expect(listArchivedSideForks()).toContainEqual({ id: ours, at: NOW - 31 * DAY })
    expect(hasArchivedSideFork(manual)).toBe(false)
    expect(hasArchivedSideFork('session-retention-seed-unknown')).toBe(false)
  })
})

describe('runSideForkRetention', () => {
  it('sends candidates and drops deleted ledger rows', async () => {
    const id = 'session-retention-run-delete'
    touched.add(id)
    rememberSideFork(id)
    rememberArchivedSideFork(id, NOW - 40 * DAY)
    const calls: unknown[] = []
    const deleted = await runSideForkRetention({
      days: 30,
      now: NOW,
      archivedIds: [id],
      summaries: {},
      api: {
        async prune(request) {
          calls.push(request)
          return { ok: true, value: { deleted: [id], skipped: [] } }
        },
      },
    })

    expect(deleted).toEqual([id])
    expect(calls).toEqual([{ sessionIds: [id], cutoffMs: NOW - 30 * DAY }])
    expect(hasArchivedSideFork(id)).toBe(false)
  })

  it('keeps the ledger row when the host says the fork is live', async () => {
    const id = 'session-retention-run-live'
    touched.add(id)
    rememberSideFork(id)
    rememberArchivedSideFork(id, NOW - 40 * DAY)

    const deleted = await runSideForkRetention({
      days: 30,
      now: NOW,
      archivedIds: [id],
      summaries: {},
      api: {
        async prune() {
          return { deleted: [], skipped: [{ id, reason: 'live' }] }
        },
      },
    })

    expect(deleted).toEqual([])
    expect(hasArchivedSideFork(id)).toBe(true)
  })

  it('clears terminal skips but keeps retryable failures', async () => {
    const gone = 'session-retention-run-missing'
    const failed = 'session-retention-run-failed'
    touched.add(gone)
    touched.add(failed)
    rememberSideFork(gone)
    rememberSideFork(failed)
    rememberArchivedSideFork(gone, NOW - 40 * DAY)
    rememberArchivedSideFork(failed, NOW - 40 * DAY)

    await runSideForkRetention({
      days: 30,
      now: NOW,
      archivedIds: [gone, failed],
      summaries: {},
      api: {
        async prune() {
          return {
            deleted: [],
            skipped: [
              { id: gone, reason: 'missing' },
              { id: failed, reason: 'io-error' },
            ],
          }
        },
      },
    })

    expect(hasArchivedSideFork(gone)).toBe(false)
    expect(hasArchivedSideFork(failed)).toBe(true)
  })

  it('does not call the host when the period is off', async () => {
    let called = false
    await runSideForkRetention({
      days: 0,
      now: NOW,
      archivedIds: [],
      summaries: {},
      api: {
        async prune() {
          called = true
          return { deleted: [], skipped: [] }
        },
      },
    })
    expect(called).toBe(false)
  })

  it('leaves the ledger intact when the host call fails', async () => {
    const id = 'session-retention-run-error'
    touched.add(id)
    rememberSideFork(id)
    rememberArchivedSideFork(id, NOW - 40 * DAY)

    await expect(
      runSideForkRetention({
        days: 30,
        now: NOW,
        archivedIds: [id],
        summaries: {},
        api: {
          async prune() {
            return { ok: false, error: { message: 'no' } }
          },
        },
      }),
    ).rejects.toThrow('no')
    expect(hasArchivedSideFork(id)).toBe(true)
    forgetArchivedSideFork(id)
  })
})

describe('unwrapPruneResult', () => {
  it('rejects a malformed payload', () => {
    expect(() => unwrapPruneResult(null)).toThrow()
    expect(() => unwrapPruneResult({ ok: true, value: {} })).toThrow()
    expect(unwrapPruneResult({ deleted: ['a'], skipped: [] })).toEqual({
      deleted: ['a'],
      skipped: [],
    })
  })
})
