import { describe, expect, it } from 'vitest'
import {
  buildTargetDirectory,
  flattenTargets,
  relativeTime,
  reusableBlankSession,
  targetUnavailable,
  type SessionListSnapshot,
  type WorkspaceListSnapshot,
} from './session-targets.ts'

const DAY = 24 * 60 * 60 * 1000
const now = 1_700_000_000_000

function sessions(
  rows: Array<{ id: string; title?: string; at?: number; origin?: string; blank?: boolean; cwd?: string }>,
): SessionListSnapshot {
  const byId: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    byId[row.id] = {
      displayTitle: row.title ?? row.id,
      updatedAt: row.at ?? now,
      ...(row.origin ? { origin: row.origin } : {}),
      ...(row.blank ? { blank: true } : {}),
      ...(row.cwd ? { cwd: row.cwd } : {}),
    }
  }
  return { ids: rows.map((row) => row.id), byId }
}

const workspaces: WorkspaceListSnapshot = {
  items: [
    { workspaceId: 'w1', title: 'Project A', path: '/a', sessionIds: ['src', 's1', 's2'] },
    { workspaceId: 'w2', title: 'Project B', path: '/b', sessionIds: ['s3'] },
  ],
  archivedSessionIds: [],
}

describe('buildTargetDirectory', () => {
  it('groups by workspace, sorts by updatedAt and excludes the source', () => {
    const snapshot = sessions([
      { id: 'src', at: now },
      { id: 's1', title: 'older', at: now - DAY },
      { id: 's2', title: 'newest', at: now - 1000 },
      { id: 's3', title: 'elsewhere', at: now - 2 * DAY },
      { id: 'loose', title: 'ungrouped', at: now - 3 * DAY },
    ])
    const directory = buildTargetDirectory({
      currentSessionId: 'src',
      sessions: snapshot,
      workspaces,
    })
    expect(directory.current.map((target) => target.sessionId)).toEqual(['s2', 's1'])
    expect(directory.other.map((target) => target.sessionId)).toEqual(['s3'])
    expect(directory.other[0]?.workspaceTitle).toBe('Project B')
    expect(directory.ungrouped.map((target) => target.sessionId)).toEqual(['loose'])
    expect(directory.defaultTarget?.sessionId).toBe('s2')
    expect(directory.newSession?.workspaceId).toBe('w1')
    expect(directory.canHandoff).toBe(true)
    // New session first, then current/other/ungrouped.
    expect(flattenTargets(directory)[0]?.kind).toBe('new')
  })

  it('drops the current session, subagents, archived sessions and blanks', () => {
    const snapshot = sessions([
      { id: 'src', at: now },
      { id: 'child', origin: 'subagent', at: now },
      { id: 'archived', at: now },
      { id: 'blank', blank: true, cwd: '/a', at: now },
      { id: 'kept', at: now - 1 },
    ])
    const directory = buildTargetDirectory({
      currentSessionId: 'src',
      sessions: snapshot,
      workspaces: {
        items: [
          {
            workspaceId: 'w1',
            title: 'Project A',
            path: '/a',
            sessionIds: ['src', 'child', 'archived', 'blank', 'kept'],
          },
        ],
        archivedSessionIds: ['archived'],
      },
    })
    expect(directory.current.map((target) => target.sessionId)).toEqual(['kept'])
  })

  it('falls back to the new-session row when nothing else exists', () => {
    const snapshot = sessions([{ id: 'src', at: now }])
    const directory = buildTargetDirectory({
      currentSessionId: 'src',
      sessions: snapshot,
      workspaces,
    })
    expect(directory.current).toEqual([])
    expect(directory.defaultTarget?.kind).toBe('new')
    expect(directory.canHandoff).toBe(true)
  })

  it('hides the entry when the source has no workspace and no cwd', () => {
    const snapshot = sessions([{ id: 'src', at: now }])
    const directory = buildTargetDirectory({
      currentSessionId: 'src',
      sessions: snapshot,
      workspaces: { items: [], archivedSessionIds: [] },
    })
    expect(directory.newSession).toBeNull()
    expect(directory.canHandoff).toBe(false)
  })

  it('returns an empty directory without host snapshots', () => {
    expect(buildTargetDirectory({ currentSessionId: 'src', sessions: undefined, workspaces: undefined }))
      .toMatchObject({ canHandoff: false, defaultTarget: null })
  })
})

describe('reusableBlankSession', () => {
  const workspace = {
    workspaceId: 'w1',
    title: 'Project A',
    path: '/a',
    sessionIds: ['blank-ok', 'blank-other-cwd', 'archived-blank'],
  }
  const snapshot = sessions([
    { id: 'blank-ok', blank: true, cwd: '/a', at: now },
    { id: 'blank-other-cwd', blank: true, cwd: '/b', at: now },
    { id: 'archived-blank', blank: true, cwd: '/a', at: now },
  ])
  const list = { ...workspaces, archivedSessionIds: ['archived-blank'] }

  it('matches the host createInWorkspace rule', () => {
    expect(
      reusableBlankSession({ sessions: snapshot, workspaces: list }, workspace, '/a'),
    ).toBe('blank-ok')
  })

  it('never reuses across workspaces or an archived blank', () => {
    expect(
      reusableBlankSession(
        { sessions: snapshot, workspaces: list },
        { ...workspace, sessionIds: ['blank-other-cwd'] },
        '/a',
      ),
    ).toBeUndefined()
  })
})

describe('targetUnavailable', () => {
  const snapshot = sessions([{ id: 'a' }])
  it('treats archived and missing sessions as unavailable', () => {
    expect(targetUnavailable('a', snapshot, { items: [], archivedSessionIds: ['a'] })).toBe(true)
    expect(targetUnavailable('gone', snapshot, { items: [] })).toBe(true)
    expect(targetUnavailable('a', snapshot, { items: [] })).toBe(false)
  })
})

describe('relativeTime', () => {
  it('uses the active locale and unit thresholds', () => {
    expect(relativeTime(now - 30_000, now, 'en')).toBe('now')
    expect(relativeTime(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago')
    expect(relativeTime(now - 3 * 60 * 60_000, now, 'en')).toBe('3 hours ago')
    expect(relativeTime(now - 2 * DAY, now, 'en')).toBe('2 days ago')
  })
})
