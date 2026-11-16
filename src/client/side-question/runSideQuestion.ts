/**
 * Client-side side-question flow.
 *
 * A side question is an ordinary Session fork: it inherits the main transcript,
 * keeps the native sidebar chat and composer, and is hidden from the catalog
 * only through the fork-state marker. The fork is retained for the first prompt
 * and promoted to a listed Session only when the user keeps it.
 */

import type { ModelChoice } from '../model/types.ts'
import type { SessionListSnapshot, WorkspaceListSnapshot } from '../selection/session-targets.ts'
import {
  forgetHiddenSideFork,
  forgetSideFork,
  isKeptSideFork,
  rememberSideFork,
} from './fork-state.ts'
import { SIDE_FORK_KIND, sideForkAddress } from './protocol.ts'
import {
  forgetReusableFork,
  rememberReusableFork,
  reusableForkFor,
} from './reuse-state.ts'

const RETAIN_SOURCE = 'selectQuoteSideQuestion'

export interface SideQuestionSessionReference {
  readonly ready: Promise<unknown>
  readonly binding: {
    readonly session: {
      rename(title: string): Promise<
        | { ok: true; value: { title: string; seq: number } }
        | { ok: false; error: { code: string; message: string } }
      >
      prompt(
        content: readonly { readonly type: 'text'; readonly text: string }[],
        mode: 'queue' | 'steer',
        signal?: AbortSignal,
        requestId?: string,
      ): Promise<
        | { ok: true; value: unknown }
        | { ok: false; error: { code: string; message: string } }
      >
    }
  }
  release(): void
}

export interface SideQuestionSessions {
  readonly list: { getSnapshot(): SessionListSnapshot }
  fork(options: {
    sessionId: string
    atSeq?: number
    allowMigration?: boolean
    increaseTitle?: boolean
    onCreated?: (sessionId: string) => void
  }): Promise<string>
  retain(
    id: string,
    options: { source: string; signal?: AbortSignal },
  ): SideQuestionSessionReference
}

export interface SideQuestionHost {
  readonly sessions: SideQuestionSessions
  readonly workspaces: { readonly list: { getSnapshot(): WorkspaceListSnapshot } }
  readonly workspace: {
    unarchiveSession(sessionId: string): Promise<void>
    archiveSession(sessionId: string, options?: { stopActivity?: boolean }): Promise<void>
  }
  readonly modelDirectories?: {
    directoryFor(sessionId: string): {
      select(selection: ModelChoice): Promise<
        | { ok: true; value: unknown }
        | { ok: false; error: { code: string; message: string } }
      >
    }
  }
  readonly sidebar: {
    openResource(address: string, options?: { kind?: string }): void
  }
}

export interface SideQuestionRequest {
  readonly parentSessionId: string
  readonly prompt: string
  /** Durable title of a newly created fork; reuse keeps its original title. */
  readonly label: string
  readonly model: ModelChoice | null
  readonly reuse: boolean
}

/**
 * Fork, seed, and reveal one side conversation.
 *
 * Separation mode always creates a new fork. Reuse mode recalls the parent's
 * fork and replaces it only when that Session no longer exists. The initial
 * prompt is queued through the retained Session's own prompt face, so the child
 * is driven by ordinary Session routing rather than a subagent continuation.
 */
export async function runSideQuestion(
  host: SideQuestionHost,
  request: SideQuestionRequest,
): Promise<void> {
  if (request.parentSessionId === '') throw new Error('no active session')

  let childId = request.reuse ? reusableForkFor(request.parentSessionId) : undefined
  if (childId !== undefined && host.sessions.list.getSnapshot().byId[childId] === undefined) {
    forgetSideFork(childId)
    forgetReusableFork(request.parentSessionId)
    childId = undefined
  }

  let created = false
  if (childId === undefined) {
    childId = await host.sessions.fork({
      sessionId: request.parentSessionId,
      onCreated: (id) => { rememberSideFork(id) },
    })
    created = true
    if (request.reuse) rememberReusableFork(request.parentSessionId, childId)
  } else if (!isKeptSideFork(childId)) {
    // A reused side fork returns to the hidden catalog until explicitly kept.
    rememberSideFork(childId)
  }

  try {
    if ((host.workspaces.list.getSnapshot().archivedSessionIds ?? []).includes(childId)) {
      await host.workspace.unarchiveSession(childId)
    }
    const reference = host.sessions.retain(childId, { source: RETAIN_SOURCE })
    try {
      await reference.ready
      if (created) {
        const renamed = await reference.binding.session.rename(request.label)
        if (!renamed.ok) {
          console.warn('dsh-select-quote: side fork rename failed', renamed.error)
        }
      }
      if (created && request.model !== null) {
        const directories = host.modelDirectories
        if (directories === undefined) {
          throw new Error('side fork model selection is unavailable')
        }
        const selected = await directories.directoryFor(childId).select(request.model)
        if (!selected.ok) {
          throw new Error(
            `side fork model selection failed: ${selected.error.code}: ${selected.error.message}`,
          )
        }
      }
      // The native composer queues through this same Session face; the scoped
      // conversation service is unreachable from a retained scope (Cordis
      // inject guard), and the Session needs no extra wiring.
      const prompted = await reference.binding.session.prompt(
        [{ type: 'text', text: request.prompt }],
        'queue',
      )
      if (!prompted.ok) {
        throw new Error(
          `side fork prompt failed: ${prompted.error.code}: ${prompted.error.message}`,
        )
      }
      host.sidebar.openResource(sideForkAddress(childId), { kind: SIDE_FORK_KIND })
    } finally {
      reference.release()
    }
  } catch (error) {
    if (created) {
      try {
        await host.workspace.archiveSession(childId, { stopActivity: true })
        forgetHiddenSideFork(childId)
      } catch {
        // A running turn can refuse the archive. Keep the id hidden while the
        // Session exists; reopening the tab retries the restore.
        if (host.sessions.list.getSnapshot().byId[childId] === undefined) {
          forgetHiddenSideFork(childId)
        }
      }
    }
    throw error
  }
}
