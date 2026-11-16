import { describe, expect, it } from 'vitest'
import { TRANSLATE_METHOD, createPluginRemote } from './plugin-remote.ts'

const translateEndpoint = createPluginRemote().methods[TRANSLATE_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const translateSchema = translateEndpoint.input({ strict: true }).create()

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
