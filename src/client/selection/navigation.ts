/**
 * Cross-session navigation and source locating.
 *
 * `ctx.uiWorkspace.openSession()` swaps the main view synchronously, but the
 * target transcript loads asynchronously. Returning to a source conversation
 * therefore retries the mark lookup for a bounded window instead of giving up
 * on the first frame — and never falls back to a full-text search, which would
 * flash an unrelated paragraph in a different conversation.
 */

import { findMark, flashAnnotationMark } from '../dom/annotate-text.ts'
import { t } from '../i18n.ts'
import { runtime } from '../runtime.ts'
import { showToast } from '../ui/toast.ts'
import { handoffMarkId, selectionKeyOf } from '../state/handoff.ts'
import type { AnnotationSource } from '../protocol/annotation-protocol.ts'
import type {
  SessionListSnapshot,
  WorkspaceListSnapshot,
} from './session-targets.ts'

/**
 * History and marks load asynchronously; a cold, long conversation can take
 * several seconds. Keep looking long enough to cover that, and stop silently
 * if the user navigates somewhere else meanwhile.
 */
const LOCATE_TIMEOUT_MS = 8000
const LOCATE_INTERVAL_MS = 100

function snapshots(): {
  sessions: SessionListSnapshot | undefined
  workspaces: WorkspaceListSnapshot | undefined
} {
  const host = runtime.handoffHost
  if (!host) return { sessions: undefined, workspaces: undefined }
  try {
    return {
      sessions: host.sessionsSnapshot(),
      workspaces: host.workspacesSnapshot(),
    }
  } catch {
    return { sessions: undefined, workspaces: undefined }
  }
}

export function isSessionArchived(sessionId: string): boolean {
  const { workspaces } = snapshots()
  return workspaces?.archivedSessionIds?.includes(sessionId) === true
}

export function sessionTitleOf(sessionId: string, fallback = ''): string {
  const { sessions } = snapshots()
  const summary = sessions?.byId[sessionId]
  const title = summary?.displayTitle?.trim() || summary?.title?.trim()
  return title || fallback || sessionId
}

/** Live workspace label for a handoff destination; empty when unknown. */
export function workspaceTitleOf(workspaceId: string | undefined): string {
  if (!workspaceId) return ''
  const { workspaces } = snapshots()
  return workspaces?.items.find((row) => row.workspaceId === workspaceId)?.title?.trim() ?? ''
}

/**
 * Open one conversation. Returns false (and never navigates) for an archived
 * or missing target; archiving is never undone automatically.
 */
export function openConversation(sessionId: string): boolean {
  const host = runtime.handoffHost
  if (!host || !sessionId) return false
  if (isSessionArchived(sessionId)) {
    showToast(t('handoff.archived', { title: sessionTitleOf(sessionId) }))
    return false
  }
  // A freshly created session can be openable before the catalog snapshot
  // carries it, so existence is the host's call, not the snapshot's.
  try {
    host.openSession(sessionId)
    return true
  } catch (error) {
    console.error('dsh-select-quote: could not open the session', error)
    showToast(t('handoff.openFailed'))
    return false
  }
}

/**
 * Open the source conversation and flash the outbound arrow mark that belongs
 * to one annotation. `markId` can be supplied directly; otherwise it is
 * derived from the annotation's text + source locator.
 */
export function openSourceAndLocate(input: {
  readonly sessionId: string
  readonly text: string
  readonly sources?: readonly AnnotationSource[]
  readonly markId?: string
}): void {
  const markId = input.markId ?? handoffMarkId(selectionKeyOf(input.text, input.sources?.[0]))
  if (!openConversation(input.sessionId)) return
  if (typeof document === 'undefined') return
  const startedAt = Date.now()
  const tick = (): void => {
    // The user moved on before the source rendered: do not nag them with a
    // toast about a conversation they already left.
    if (runtime.sessionId !== undefined && runtime.sessionId !== input.sessionId) return
    const mark = findMark(markId)
    if (mark) {
      flashAnnotationMark(mark)
      return
    }
    if (Date.now() - startedAt >= LOCATE_TIMEOUT_MS) {
      showToast(t('handoff.sourceMissing'))
      return
    }
    window.setTimeout(tick, LOCATE_INTERVAL_MS)
  }
  // First attempt on the next frame: openSession may have already swapped the
  // view, and the source transcript can render before this call returns.
  window.setTimeout(tick, 0)
}
