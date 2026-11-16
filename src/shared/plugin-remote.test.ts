import { describe, expect, it } from 'vitest'
import {
  SIDE_FORK_RETENTION_METHOD,
  TRANSLATE_METHOD,
  createPluginRemote,
} from './plugin-remote.ts'

const translateEndpoint = createPluginRemote().methods[TRANSLATE_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const translateSchema = translateEndpoint.input({ strict: true }).create()

const pruneEndpoint = createPluginRemote().methods[SIDE_FORK_RETENTION_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const pruneSchema = pruneEndpoint.input({ strict: true }).create()

describe('translate stream contract', () => {
  const descriptors = createPluginRemote().descriptors as unknown as {
    id: string
    mode?: string
    cancellation?: { parameter?: string }
  }[]
  const descriptor = descriptors.find((entry) =>
    entry.id.endsWith(`#${TRANSLATE_METHOD}`),
  )

  it('mounts a cancellable stream, not a unary call', () => {
    expect(descriptor?.mode).toBe('stream')
    expect(descriptor?.cancellation).toEqual({ parameter: 'signal' })
  })
})

describe('side-fork prune contract', () => {
  it('is a direct unary method with a strict request', () => {
    const descriptor = createPluginRemote().descriptors.find(
      (entry) => (entry as { method?: string }).method === 'prune',
    ) as
      | { mode?: string; invocation?: { kind?: string }; service?: string }
      | undefined
    expect(descriptor?.mode).toBeUndefined()
    expect(descriptor?.invocation?.kind).toBe('direct')
    expect(descriptor?.service).toBe('selectQuoteSideForkRetention')
  })

  it('carries candidate ids and a cutoff, and rejects extras', () => {
    expect(
      pruneSchema.parse({
        request: { sessionIds: ['session-a'], cutoffMs: 1_700_000_000_000 },
      }),
    ).toEqual({ request: { sessionIds: ['session-a'], cutoffMs: 1_700_000_000_000 } })
    expect(() =>
      pruneSchema.parse({ request: { sessionIds: [], cutoffMs: 1, extra: true } }),
    ).toThrow()
  })
})

describe('translate request schema', () => {
  const base = {
    agentId: 'session-main',
    request: { text: 'Hello', target: 'zh', prompt: 'Translate into Chinese.' },
  }

  it('accepts a request that follows the conversation route', () => {
    expect(translateSchema.parse(base)).toMatchObject({ request: { target: 'zh' } })
  })

  it('keeps an explicit route', () => {
    expect(
      translateSchema.parse({
        ...base,
        request: { ...base.request, provider: 'deepseek-account', model: 'deepseek-v4-flash' },
      }),
    ).toMatchObject({
      request: { provider: 'deepseek-account', model: 'deepseek-v4-flash' },
    })
  })

  it('requires the selected text and the resolved prompt', () => {
    expect(() =>
      translateSchema.parse({ agentId: 'session-main', request: { target: 'zh', prompt: 'x' } }),
    ).toThrow()
    expect(() =>
      translateSchema.parse({ agentId: 'session-main', request: { text: 'Hello', target: 'zh' } }),
    ).toThrow()
  })

  it('rejects an unknown request field', () => {
    expect(() =>
      translateSchema.parse({ ...base, request: { ...base.request, extra: true } }),
    ).toThrow()
  })
})
