/**
 * Target directory for "send this annotation to another conversation".
 *
 * Pure functions over the host's session/workspace snapshots: grouping,
 * ordering, exclusion, the default target and blank-session reuse. The picker
 * renders the result; the toolbar only reads `defaultTarget` for its label.
 */

/** Read face of one session summary (`ctx.sessions.list` snapshot item). */
export interface SessionSummary {
  readonly displayTitle?: string
  readonly title?: string
  readonly updatedAt?: number
  readonly cwd?: string
  readonly parentId?: string
  /** `'subagent'` sessions never appear as handoff targets. */
  readonly origin?: string
  /** A blank session is represented by the picker's "new session" row. */
  readonly blank?: boolean
  readonly running?: boolean
}

export interface SessionListSnapshot {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummary | undefined>>
}

export interface WorkspaceRow {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
  readonly sessionIds: readonly string[]
}

export interface WorkspaceListSnapshot {
  readonly items: readonly WorkspaceRow[]
  readonly archivedSessionIds?: readonly string[]
  readonly pinnedSessionIds?: readonly string[]
}

/**
 * `existing` is another session, `new` a fresh one, `here` the conversation
 * being read — the picker's first row, which keeps the passage where it is.
 */
export type TargetKind = 'existing' | 'new' | 'here'

export interface TargetSession {
  readonly kind: TargetKind
  /** Empty for the pseudo target "new session". */
  readonly sessionId: string
  /** Live title; empty for "new session" (the UI localizes its label). */
  readonly title: string
  readonly workspaceId?: string
  readonly workspaceTitle?: string
  readonly updatedAt: number
}

export interface TargetDirectory {
  /** The conversation being read; the picker opens with it as the first row. */
  readonly here: TargetSession | null
  /** The pseudo target, or null when the source has no workspace and no cwd. */
  readonly newSession: TargetSession | null
  /** Sessions of the source's own workspace, newest first. */
  readonly current: readonly TargetSession[]
  /** Sessions of every other workspace, newest first. */
  readonly other: readonly TargetSession[]
  /** Sessions not accounted to any workspace, newest first. */
  readonly ungrouped: readonly TargetSession[]
  /** What a plain click on the action uses; null hides the entry. */
  readonly defaultTarget: TargetSession | null
  readonly canHandoff: boolean
  /** Workspace the source session belongs to (used by "new session"). */
  readonly currentWorkspace?: WorkspaceRow
  /** Source session's own cwd, for an ungrouped source. */
  readonly sourceCwd?: string
}

const EMPTY_DIRECTORY: TargetDirectory = {
  here: null,
  newSession: null,
  current: [],
  other: [],
  ungrouped: [],
  defaultTarget: null,
  canHandoff: false,
}

export function liveTitle(summary: SessionSummary | undefined, fallback = ''): string {
  const title = summary?.displayTitle?.trim() || summary?.title?.trim()
  return title || fallback
}

function updatedAtOf(summary: SessionSummary | undefined): number {
  return typeof summary?.updatedAt === 'number' ? summary.updatedAt : 0
}

/** First workspace accounting the session, matching the host's manual order. */
function workspaceOf(
  workspaces: readonly WorkspaceRow[],
  sessionId: string,
): WorkspaceRow | undefined {
  return workspaces.find((workspace) => workspace.sessionIds.includes(sessionId))
}

/**
 * Build the picker's directory.
 *
 * Excluded: the current session, subagent conversations, archived sessions and
 * blank sessions (the "new session" row represents all of them). Ordering is
 * strictly `updatedAt` descending — never the sidebar's manual order, so
 * "recent" cannot drift between the two surfaces.
 */
export function buildTargetDirectory(input: {
  readonly currentSessionId?: string
  readonly sessions: SessionListSnapshot | undefined
  readonly workspaces: WorkspaceListSnapshot | undefined
}): TargetDirectory {
  const { currentSessionId, sessions, workspaces } = input
  if (!sessions || !workspaces) return EMPTY_DIRECTORY
  const archived = new Set(workspaces.archivedSessionIds ?? [])
  const source = currentSessionId ? sessions.byId[currentSessionId] : undefined
  const currentWorkspace = currentSessionId
    ? workspaceOf(workspaces.items, currentSessionId)
    : undefined
  const sourceCwd = source?.cwd?.trim() || undefined

  const current: TargetSession[] = []
  const other: TargetSession[] = []
  const ungrouped: TargetSession[] = []
  const seen = new Set<string>()

  for (const id of sessions.ids) {
    if (!id || id === currentSessionId || seen.has(id)) continue
    seen.add(id)
    const summary = sessions.byId[id]
    if (!summary) continue
    if (summary.origin === 'subagent') continue
    if (archived.has(id)) continue
    if (summary.blank === true) continue
    const workspace = workspaceOf(workspaces.items, id)
    const target: TargetSession = {
      kind: 'existing',
      sessionId: id,
      title: liveTitle(summary, id),
      ...(workspace ? { workspaceId: workspace.workspaceId, workspaceTitle: workspace.title } : {}),
      updatedAt: updatedAtOf(summary),
    }
    if (workspace && currentWorkspace && workspace.workspaceId === currentWorkspace.workspaceId) {
      current.push(target)
    } else if (workspace) {
      other.push(target)
    } else {
      ungrouped.push(target)
    }
  }

  const newestFirst = (a: TargetSession, b: TargetSession): number => b.updatedAt - a.updatedAt
  current.sort(newestFirst)
  other.sort(newestFirst)
  ungrouped.sort(newestFirst)

  const newSession: TargetSession | null =
    currentWorkspace || sourceCwd
      ? {
          kind: 'new',
          sessionId: '',
          title: '',
          ...(currentWorkspace
            ? {
                workspaceId: currentWorkspace.workspaceId,
                workspaceTitle: currentWorkspace.title,
              }
            : {}),
          updatedAt: 0,
        }
      : null

  const here: TargetSession | null = currentSessionId
    ? {
        kind: 'here',
        sessionId: currentSessionId,
        title: '',
        ...(currentWorkspace
          ? { workspaceId: currentWorkspace.workspaceId, workspaceTitle: currentWorkspace.title }
          : {}),
        updatedAt: updatedAtOf(source),
      }
    : null

  const defaultTarget = current[0] ?? newSession ?? other[0] ?? ungrouped[0] ?? null
  return {
    here,
    newSession,
    current,
    other,
    ungrouped,
    defaultTarget,
    canHandoff: defaultTarget !== null,
    ...(currentWorkspace ? { currentWorkspace } : {}),
    ...(sourceCwd ? { sourceCwd } : {}),
  }
}

/** Every row in render order (search and keyboard navigation flatten this). */
export function flattenTargets(directory: TargetDirectory): readonly TargetSession[] {
  return [
    ...(directory.here ? [directory.here] : []),
    ...(directory.newSession ? [directory.newSession] : []),
    ...directory.current,
    ...directory.other,
    ...directory.ungrouped,
  ]
}

/** Stable identity for selection and focus (`new` or the session id). */
export function targetId(target: TargetSession): string {
  return target.kind === 'new' ? 'new' : target.kind === 'here' ? 'here' : target.sessionId
}

export function findTarget(
  directory: TargetDirectory,
  id: string | undefined,
): TargetSession | undefined {
  if (!id) return undefined
  return flattenTargets(directory).find((target) => targetId(target) === id)
}

/**
 * Blank session the host itself would reuse for "new session in this
 * workspace": blank, same cwd, accounted to the workspace, not archived.
 * Mirrors `createInWorkspace` in the host's session controller.
 */
export function reusableBlankSession(
  input: {
    readonly sessions: SessionListSnapshot | undefined
    readonly workspaces: WorkspaceListSnapshot | undefined
  },
  workspace: WorkspaceRow | undefined,
  cwd: string | undefined,
): string | undefined {
  const { sessions, workspaces } = input
  if (!sessions) return undefined
  const archived = new Set(workspaces?.archivedSessionIds ?? [])
  if (!workspace) {
    // Ungrouped source: the host's `{ cwd }` create has no workspace list to
    // match against, so there is nothing safe to reuse.
    return undefined
  }
  const path = workspace.path ?? cwd
  return sessions.ids.find((id) => {
    const summary = sessions.byId[id]
    return (
      summary !== undefined &&
      summary.blank === true &&
      summary.cwd === path &&
      workspace.sessionIds.includes(id) &&
      !archived.has(id)
    )
  })
}

/** True when the target is no longer openable (archived or deleted). */
export function targetUnavailable(
  sessionId: string,
  sessions: SessionListSnapshot | undefined,
  workspaces: WorkspaceListSnapshot | undefined,
): boolean {
  if (!sessionId) return false
  const archived = workspaces?.archivedSessionIds ?? []
  if (archived.includes(sessionId)) return true
  if (!sessions) return true
  return sessions.byId[sessionId] === undefined
}

/** Short relative time in the active interface language (pure, no DOM). */
export function relativeTime(updatedAt: number, now: number, locale: string): string {
  const delta = updatedAt > 0 ? updatedAt - now : 0
  const abs = Math.abs(delta)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  let value: number
  let unit: Intl.RelativeTimeFormatUnit
  if (abs < minute) {
    value = 0
    unit = 'second'
  } else if (abs < hour) {
    value = Math.round(delta / minute)
    unit = 'minute'
  } else if (abs < day) {
    value = Math.round(delta / hour)
    unit = 'hour'
  } else if (abs < 7 * day) {
    value = Math.round(delta / day)
    unit = 'day'
  } else {
    value = Math.round(delta / day)
    unit = 'day'
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(value, unit)
  }
}
