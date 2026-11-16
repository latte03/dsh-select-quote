import { Service, type Context } from '@deepseek-ai/cordis'
import { rm, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, parse } from 'node:path'
import {
  SIDE_FORK_RETENTION_SERVICE,
  type SideForkPruneRequest,
  type SideForkPruneResult,
  type SideForkPruneSkipReason,
} from './shared/plugin-remote.ts'

/**
 * Host half of side-fork retention.
 *
 * The persistence contract has no delete operation, so this is the one place
 * that unlinks a session directory. It trusts nothing from the browser: the id
 * must still be archived, the live store must not hold it, the stored header
 * must be a seeded fork, and the selected log file must be old. Anything else
 * is reported back as a skip instead of being deleted.
 */

const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const REMOTE_METHODS = Object.freeze({
  version: 1,
  methods: Object.freeze([
    Object.freeze({
      method: 'prune',
      invocation: Object.freeze({ kind: 'direct' }),
    }),
  ]),
})

const MAX_IDS = 512
const LOG_FILE = /^session\..*\.jsonl(?:\.zstd)?$/

interface StoredHeader {
  readonly id: string
  readonly isSeeded?: boolean
}

interface StoredSession {
  readonly header: StoredHeader
  readonly location?: {
    readonly kind?: string
    readonly path?: string
  }
}

interface SessionPersistenceFace {
  stat(id: string): Promise<StoredSession | undefined>
}

interface WorkspaceRegistryFace {
  readonly archivedSessionIds: readonly string[]
}

interface LiveStoreFace {
  get(id: string): unknown
}

interface Logger {
  warn(format: unknown, ...args: unknown[]): void
}

interface HostServices {
  readonly sessionPersistence?: SessionPersistenceFace
  readonly workspaceRegistry?: WorkspaceRegistryFace
  readonly logger?: Logger | ((name?: string) => Logger)
  get(name: string): unknown
}

export class SelectQuoteSideForkRetention extends Service {
  /** Visible binding the Gateway's source-mode discovery requires. */
  readonly typertRemote: { service: unknown; serviceKey: string; namespace: string }

  constructor(ctx: Context) {
    super(ctx, SIDE_FORK_RETENTION_SERVICE)
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: SIDE_FORK_RETENTION_SERVICE,
      namespace: SIDE_FORK_RETENTION_SERVICE,
    })
  }

  async prune(request: SideForkPruneRequest): Promise<SideForkPruneResult> {
    const services = this.ctx as unknown as HostServices
    const log = loggerOf(services.logger)
    if (!Number.isFinite(request.cutoffMs) || request.cutoffMs <= 0) {
      throw new Error('invalid retention cutoff')
    }
    if (!Array.isArray(request.sessionIds)) {
      throw new Error('invalid retention candidates')
    }
    const persistence = services.sessionPersistence
    const workspace = services.workspaceRegistry
    if (persistence === undefined || workspace === undefined) {
      throw new Error('session storage is unavailable')
    }
    const live = services.get('sessions') as LiveStoreFace | undefined
    if (live === undefined) throw new Error('the live session store is unavailable')

    const archived = new Set(workspace.archivedSessionIds)
    const seen = new Set<string>()
    const deleted: string[] = []
    const skipped: { id: string; reason: SideForkPruneSkipReason }[] = []

    for (const value of (request.sessionIds as readonly unknown[]).slice(0, MAX_IDS)) {
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        skipped.push({ id: String(value), reason: 'invalid-id' })
        continue
      }
      const id = value
      if (seen.has(id)) continue
      seen.add(id)
      if (!archived.has(id)) {
        skipped.push({ id, reason: 'not-archived' })
        continue
      }
      if (live.get(id) !== undefined) {
        skipped.push({ id, reason: 'live' })
        continue
      }

      let stored: StoredSession | undefined
      try {
        stored = await persistence.stat(id)
      } catch (error) {
        log?.warn('dsh-select-quote: retention could not inspect "%s": %s', id, error)
        skipped.push({ id, reason: 'io-error' })
        continue
      }
      if (stored === undefined) {
        skipped.push({ id, reason: 'missing' })
        continue
      }
      // A fork header carries `isSeeded`; `parentSession` is optional and is
      // absent on real side forks, so it cannot be part of the gate.
      if (stored.header.id !== id || stored.header.isSeeded !== true) {
        skipped.push({ id, reason: 'not-fork' })
        continue
      }
      const path = stored.location?.path
      if (stored.location?.kind !== 'jsonl' || typeof path !== 'string' || path.length === 0) {
        skipped.push({ id, reason: 'no-path' })
        continue
      }
      const dir = dirname(path)
      if (
        !isAbsolute(path)
        || parse(dir).root === dir
        || !LOG_FILE.test(basename(path))
      ) {
        skipped.push({ id, reason: 'unsafe-path' })
        continue
      }

      try {
        const info = await stat(path)
        if (info.mtimeMs > request.cutoffMs) {
          skipped.push({ id, reason: 'recent' })
          continue
        }
        if (live.get(id) !== undefined) {
          skipped.push({ id, reason: 'live' })
          continue
        }
        await rm(dir, { recursive: true, force: true })
        deleted.push(id)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code
        const reason: SideForkPruneSkipReason = code === 'ENOENT' ? 'missing' : 'io-error'
        log?.warn('dsh-select-quote: retention could not delete "%s": %s', id, error)
        skipped.push({ id, reason })
      }
    }

    return { deleted, skipped }
  }
}

/** Resolve the callable logger facade (`ctx.logger` is callable in Cordis). */
function loggerOf(source: HostServices['logger']): Logger | undefined {
  if (typeof source === 'function') {
    try {
      return source('dsh-select-quote')
    } catch {
      return undefined
    }
  }
  return source
}

// Attach after the class declaration: the Gateway reads markers off the live
// instance's prototype, and the key is the protocol package's public string.
Object.defineProperty(SelectQuoteSideForkRetention.prototype, REMOTE_METHOD_DESCRIPTOR, {
  configurable: true,
  value: REMOTE_METHODS,
})
