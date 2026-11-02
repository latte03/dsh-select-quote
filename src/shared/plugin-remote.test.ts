import { describe, expect, it } from 'vitest'
import {
  SIDE_TASK_METHOD,
  TRANSLATE_METHOD,
  createPluginRemote,
} from './plugin-remote.ts'

const endpoint = createPluginRemote().methods[SIDE_TASK_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const strictSchema = endpoint.input({ strict: true }).create()

const translateEndpoint = createPluginRemote().methods[TRANSLATE_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const translateSchema = translateEndpoint.input({ strict: true }).create()

const request = (model?: Record<string, unknown>) => ({
  agentId: 'session-main',
  request: { prompt: '为什么？', ...(model === undefined ? {} : { model }) },
})

describe('side task request schema', () => {
  it('keeps the optional child model route', () => {
    expect(
      strictSchema.parse(
        request({ provider: 'deepseek-account', model: 'deepseek-v4-pro', reasoningEffort: 'high' }),
      ),
    ).toMatchObject({
      request: { model: { provider: 'deepseek-account', model: 'deepseek-v4-pro' } },
    })
  })

  it('still accepts a request without a model override', () => {
    expect(strictSchema.parse(request())).toMatchObject({ request: { prompt: '为什么？' } })
  })

  it('accepts the reuse flag', () => {
    expect(
      strictSchema.parse({
        agentId: 'session-main',
        request: { prompt: '为什么？', reuse: true },
      }),
    ).toMatchObject({ request: { reuse: true } })
  })

  it('rejects a non-boolean reuse flag', () => {
    expect(() =>
      strictSchema.parse({
        agentId: 'session-main',
        request: { prompt: '为什么？', reuse: 'yes' },
      }),
    ).toThrow()
  })

  it('rejects an unknown field inside the model route', () => {
    expect(() =>
      strictSchema.parse(request({ provider: 'p', model: 'm', extra: true })),
    ).toThrow()
  })
})

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
