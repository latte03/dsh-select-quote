import { describe, expect, it } from 'vitest'
import type { ModelChoice } from '../model/types.ts'
import {
  forgetSideFork,
  isHiddenSideFork,
  keepSideFork,
  rememberSideFork,
} from './fork-state.ts'
import { SIDE_FORK_KIND, sideForkAddress } from './protocol.ts'
import { forgetReusableFork, reusableForkFor, rememberReusableFork } from './reuse-state.ts'
import { runSideQuestion, type SideQuestionHost } from './runSideQuestion.ts'

interface HostOptions {
  readonly parentId: string
  readonly childId: string
  readonly archived?: string[]
  readonly sendError?: Error
  readonly selectError?: { code: string; message: string }
}

function makeHost(options: HostOptions) {
  const byId: Record<string, object> = { [options.parentId]: {} }
  const archived = new Set(options.archived ?? [])
  const log = {
    fork: [] as string[],
    rename: [] as string[],
    select: [] as ModelChoice[],
    send: [] as string[],
    open: [] as { address: string; kind?: string }[],
    archive: [] as string[],
    unarchive: [] as string[],
    release: 0,
  }
  const host: SideQuestionHost = {
    sessions: {
      list: {
        getSnapshot: () => ({ ids: Object.keys(byId), byId }),
      },
      fork: async (forkOptions) => {
        log.fork.push(forkOptions.sessionId)
        byId[options.childId] = {}
        forkOptions.onCreated?.(options.childId)
        return options.childId
      },
      retain: () => ({
        ready: Promise.resolve(),
        binding: {
          session: {
            rename: async (title: string) => {
              log.rename.push(title)
              return { ok: true as const, value: { title, seq: 1 } }
            },
            prompt: async (content: readonly { readonly type: 'text'; readonly text: string }[]) => {
              if (options.sendError !== undefined) {
                return {
                  ok: false as const,
                  error: { code: 'prompt/failed', message: options.sendError.message },
                }
              }
              log.send.push(content.map((part) => part.text).join(''))
              return { ok: true as const, value: undefined }
            },
          },
        },
        release: () => { log.release += 1 },
      }),
    },
    workspaces: {
      list: { getSnapshot: () => ({ items: [], archivedSessionIds: [...archived] }) },
    },
    workspace: {
      unarchiveSession: async (sessionId: string) => {
        log.unarchive.push(sessionId)
        archived.delete(sessionId)
      },
      archiveSession: async (sessionId: string) => {
        log.archive.push(sessionId)
      },
    },
    modelDirectories: {
      directoryFor: () => ({
        select: async (selection: ModelChoice) => {
          log.select.push(selection)
          return options.selectError === undefined
            ? { ok: true as const, value: undefined }
            : { ok: false as const, error: options.selectError }
        },
      }),
    },
    sidebar: {
      openResource: (address, openOptions) => {
        log.open.push({ address, kind: openOptions?.kind })
      },
    },
  }
  return { host, log, archived }
}

const model: ModelChoice = { provider: 'deepseek-account', model: 'deepseek-v4-pro', reasoningEffort: 'high' }

describe('runSideQuestion', () => {
  it('creates, renames, routes, seeds, and reveals a separate side fork', async () => {
    const parentId = 'session-side-parent-separate'
    const childId = 'session-side-child-separate'
    const { host, log } = makeHost({ parentId, childId })
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '为什么？',
      label: '侧边提问 · 为什么',
      model,
      reuse: false,
    })

    expect(log.fork).toEqual([parentId])
    expect(log.rename).toEqual(['侧边提问 · 为什么'])
    expect(log.select).toEqual([model])
    expect(log.send).toEqual(['为什么？'])
    expect(log.open).toEqual([{
      address: sideForkAddress(childId),
      kind: SIDE_FORK_KIND,
    }])
    expect(log.release).toBe(1)
    expect(log.archive).toEqual([])
    expect(isHiddenSideFork(childId)).toBe(true)
    forgetSideFork(childId)
  })

  it('reuses one fork in reuse mode and only renames the first creation', async () => {
    const parentId = 'session-side-parent-reuse'
    const childId = 'session-side-child-reuse'
    const { host, log } = makeHost({ parentId, childId })
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '第一问',
      label: '侧边提问 · 第一问',
      model,
      reuse: true,
    })
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '第二问',
      label: '侧边提问 · 第二问',
      model: null,
      reuse: true,
    })

    expect(log.fork).toEqual([parentId])
    expect(log.rename).toEqual(['侧边提问 · 第一问'])
    expect(log.select).toEqual([model])
    expect(log.send).toEqual(['第一问', '第二问'])
    expect(log.open).toHaveLength(2)
    expect(reusableForkFor(parentId)).toBe(childId)
    forgetSideFork(childId)
    forgetReusableFork(parentId)
  })

  it('replaces a remembered fork whose Session no longer exists', async () => {
    const parentId = 'session-side-parent-stale'
    const missingId = 'session-side-child-missing'
    const childId = 'session-side-child-stale-new'
    rememberReusableFork(parentId, missingId)
    const { host, log } = makeHost({ parentId, childId })
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '重新开始',
      label: '侧边提问 · 重新开始',
      model: null,
      reuse: true,
    })

    expect(log.fork).toEqual([parentId])
    expect(reusableForkFor(parentId)).toBe(childId)
    forgetSideFork(childId)
    forgetReusableFork(parentId)
  })

  it('reopens an archived reused fork before sending', async () => {
    const parentId = 'session-side-parent-archived'
    const childId = 'session-side-child-archived'
    rememberReusableFork(parentId, childId)
    const { host, log } = makeHost({
      parentId,
      childId,
      archived: [childId],
    })
    // The Session is catalogued even while archived.
    ;(host.sessions.list.getSnapshot().byId as Record<string, object>)[childId] = {}
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '继续问',
      label: '侧边提问 · 继续问',
      model: null,
      reuse: true,
    })

    expect(log.unarchive).toEqual([childId])
    expect(log.fork).toEqual([])
    expect(log.send).toEqual(['继续问'])
    forgetSideFork(childId)
    forgetReusableFork(parentId)
  })

  it('does not hide a kept reused fork again', async () => {
    const parentId = 'session-side-parent-kept'
    const childId = 'session-side-child-kept'
    rememberReusableFork(parentId, childId)
    rememberSideFork(childId)
    keepSideFork(childId)
    const { host } = makeHost({ parentId, childId })
    ;(host.sessions.list.getSnapshot().byId as Record<string, object>)[childId] = {}
    await runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '保留后继续',
      label: '侧边提问 · 保留后继续',
      model: null,
      reuse: true,
    })

    expect(isHiddenSideFork(childId)).toBe(false)
    forgetSideFork(childId)
    forgetReusableFork(parentId)
  })

  it('archives a newly created fork when model selection fails', async () => {
    const parentId = 'session-side-parent-model-fail'
    const childId = 'session-side-child-model-fail'
    const { host, log } = makeHost({
      parentId,
      childId,
      selectError: { code: 'llm/route-invalid', message: 'no route' },
    })
    await expect(runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '换个模型',
      label: '侧边提问 · 换个模型',
      model,
      reuse: false,
    })).rejects.toThrow('side fork model selection failed')

    expect(log.send).toEqual([])
    expect(log.open).toEqual([])
    expect(log.archive).toEqual([childId])
    expect(log.release).toBe(1)
    expect(isHiddenSideFork(childId)).toBe(false)
    forgetSideFork(childId)
  })

  it('archives a newly created fork when the first prompt is refused', async () => {
    const parentId = 'session-side-parent-send-fail'
    const childId = 'session-side-child-send-fail'
    const { host, log } = makeHost({
      parentId,
      childId,
      sendError: new Error('queue full'),
    })
    await expect(runSideQuestion(host, {
      parentSessionId: parentId,
      prompt: '发不出去',
      label: '侧边提问 · 发不出去',
      model: null,
      reuse: false,
    })).rejects.toThrow('queue full')

    expect(log.open).toEqual([])
    expect(log.archive).toEqual([childId])
    expect(isHiddenSideFork(childId)).toBe(false)
    forgetSideFork(childId)
  })
})
