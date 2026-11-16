import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { SelectQuoteSideForkRetention } from './side-fork-retention-service.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(options: {
  archived?: boolean
  seeded?: boolean
  live?: boolean
  mtimeMs?: number
  fileName?: string
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-select-quote-retention-'))
  roots.push(root)
  const id = 'session-retention-host'
  const dir = join(root, 'project', id)
  const path = join(dir, options.fileName ?? 'session.v4.jsonl.zstd')
  await mkdir(dir, { recursive: true })
  await writeFile(path, '{}')
  if (options.mtimeMs !== undefined) {
    const at = new Date(options.mtimeMs)
    await utimes(path, at, at)
  }

  const archived = options.archived !== false
  const services = {
    reflect: { provide() {} },
    sessionPersistence: {
      async stat(requested: string) {
        if (requested !== id) return undefined
        return {
          header: { id, isSeeded: options.seeded !== false },
          location: { kind: 'jsonl', path },
        }
      },
    },
    workspaceRegistry: { archivedSessionIds: archived ? [id] : [] },
    get(name: string) {
      if (name !== 'sessions') return undefined
      return { get: (requested: string) => (options.live === true && requested === id ? {} : undefined) }
    },
    logger: { warn() {} },
  }
  const service = new SelectQuoteSideForkRetention(services as unknown as Context)
  return { id, dir, path, service }
}

describe('SelectQuoteSideForkRetention.prune', () => {
  it('deletes an old archived fork directory', async () => {
    const { id, dir, service } = await fixture({ mtimeMs: 0 })
    const result = await service.prune({
      sessionIds: [id],
      cutoffMs: Date.now(),
    })

    expect(result).toEqual({ deleted: [id], skipped: [] })
    await expect(stat(dir)).rejects.toThrow()
  })

  it('leaves a recent log alone', async () => {
    const { id, dir, service } = await fixture({
      mtimeMs: Date.now(),
    })
    const result = await service.prune({
      sessionIds: [id],
      cutoffMs: Date.now() - 24 * 60 * 60 * 1000,
    })

    expect(result.deleted).toEqual([])
    expect(result.skipped).toEqual([{ id, reason: 'recent' }])
    expect((await stat(dir)).isDirectory()).toBe(true)
  })

  it('refuses a live session, a non-fork, and an unarchived id', async () => {
    const live = await fixture({ live: true, mtimeMs: 0 })
    const notFork = await fixture({ seeded: false, mtimeMs: 0 })
    const unarchived = await fixture({ archived: false, mtimeMs: 0 })
    const request = { cutoffMs: Date.now() }

    await expect(live.service.prune({ ...request, sessionIds: [live.id] })).resolves.toEqual({
      deleted: [],
      skipped: [{ id: live.id, reason: 'live' }],
    })
    await expect(notFork.service.prune({ ...request, sessionIds: [notFork.id] })).resolves.toEqual({
      deleted: [],
      skipped: [{ id: notFork.id, reason: 'not-fork' }],
    })
    await expect(
      unarchived.service.prune({ ...request, sessionIds: [unarchived.id] }),
    ).resolves.toEqual({
      deleted: [],
      skipped: [{ id: unarchived.id, reason: 'not-archived' }],
    })
    expect((await stat(live.dir)).isDirectory()).toBe(true)
    expect((await stat(notFork.dir)).isDirectory()).toBe(true)
    expect((await stat(unarchived.dir)).isDirectory()).toBe(true)
  })

  it('refuses a location that is not a canonical session log', async () => {
    const { id, dir, service } = await fixture({
      fileName: 'notes.txt',
      mtimeMs: 0,
    })
    const result = await service.prune({
      sessionIds: [id],
      cutoffMs: Date.now(),
    })

    expect(result).toEqual({ deleted: [], skipped: [{ id, reason: 'unsafe-path' }] })
    expect((await stat(dir)).isDirectory()).toBe(true)
  })

  it('rejects an invalid cutoff instead of guessing one', async () => {
    const { id, service } = await fixture({ mtimeMs: 0 })
    await expect(
      service.prune({ sessionIds: [id], cutoffMs: Number.NaN }),
    ).rejects.toThrow('invalid retention cutoff')
  })
})
