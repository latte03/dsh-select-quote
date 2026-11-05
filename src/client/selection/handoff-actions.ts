/**
 * The write half of the handoff flow: resolve the "new session" pseudo target
 * and commit one selection into the target partition.
 *
 * Kept out of the React component so the ordering (target pending first, then
 * the source outbound record) lives in one place and stays testable.
 */

import type { SelectionSnapshot } from '../dom/selection.ts'
import { runtime } from '../runtime.ts'
import { saveHandoff, type HandoffDestination } from '../state/annotation-store.ts'
import {
  reusableBlankSession,
  type SessionListSnapshot,
  type TargetDirectory,
  type TargetSession,
  type WorkspaceListSnapshot,
} from './session-targets.ts'

export interface HandoffOutcome {
  readonly ok: boolean
  /** Resolved destination id (existing, reused blank or freshly created). */
  readonly targetId?: string
  /** False means storage failed and the pair lives in memory only. */
  readonly persisted?: boolean
  readonly error?: string
}

/** Read the live snapshots once for one resolution attempt. */
function snapshots(): {
  sessions: SessionListSnapshot | undefined
  workspaces: WorkspaceListSnapshot | undefined
} {
  const host = runtime.handoffHost
  if (!host) return { sessions: undefined, workspaces: undefined }
  try {
    return { sessions: host.sessionsSnapshot(), workspaces: host.workspacesSnapshot() }
  } catch {
    return { sessions: undefined, workspaces: undefined }
  }
}

/**
 * Resolve the pseudo target "new session": reuse the workspace's existing blank
 * (the same match the host's `createInWorkspace` uses), otherwise create one
 * through the host. Creation does not navigate, so the source page stays put;
 * canceling afterwards never deletes the created blank.
 */
export async function resolveNewSessionId(
  directory: TargetDirectory,
  target: TargetSession,
): Promise<string> {
  const host = runtime.handoffHost
  if (!host) throw new Error('handoff is unavailable')
  const { sessions, workspaces } = snapshots()
  const workspaceId = target.workspaceId ?? directory.currentWorkspace?.workspaceId
  const workspace = workspaceId
    ? workspaces?.items.find((row) => row.workspaceId === workspaceId)
    : undefined
  const cwd = directory.sourceCwd
  const blank = reusableBlankSession({ sessions, workspaces }, workspace, cwd)
  if (blank) return blank
  const request = workspace ? { workspaceId: workspace.workspaceId } : cwd ? { cwd } : undefined
  if (!request) throw new Error('no workspace or cwd for a new session')
  const created = await host.createSession(request)
  if (typeof created !== 'string' || created === '') {
    throw new Error('the host did not return a session id')
  }
  return created
}

/**
 * Commit one selection into `target`. The target partition is written before
 * the source outbound record; `saveHandoff` keeps both in memory even when
 * storage fails, and reports that as `persisted: false`.
 */
export async function putHandoff(input: {
  readonly sourceSessionId: string
  readonly sourceTitle: string
  readonly snapshot: SelectionSnapshot
  readonly target: TargetSession
  readonly directory: TargetDirectory
  readonly comment: string
}): Promise<HandoffOutcome> {
  const source = input.snapshot.source
  const sources = source
    ? [
        {
          text: input.snapshot.text,
          messageId: source.messageId,
          messageKind: source.messageKind,
          startOffset: source.startOffset,
          endOffset: source.endOffset,
        },
      ]
    : [{ text: input.snapshot.text }]

  let targetId = input.target.sessionId
  if (input.target.kind === 'new') {
    targetId = await resolveNewSessionId(input.directory, input.target)
  }
  if (!targetId) return { ok: false, error: 'no target session' }
  if (targetId === input.sourceSessionId) {
    return { ok: false, error: 'the source session cannot be its own target' }
  }

  const destination: HandoffDestination = {
    sessionId: targetId,
    kind: input.target.kind,
    title: input.target.title,
    ...(input.target.workspaceId ? { workspaceId: input.target.workspaceId } : {}),
  }
  const result = saveHandoff(input.sourceSessionId, {
    text: input.snapshot.text,
    comment: input.comment,
    sources,
    origin: { sessionId: input.sourceSessionId, title: input.sourceTitle },
    destination,
  })
  return { ok: true, targetId, persisted: result.persisted }
}
