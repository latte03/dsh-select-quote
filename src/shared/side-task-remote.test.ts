import { describe, expect, it } from 'vitest'
import { SIDE_TASK_METHOD, createSideTaskRemote } from './side-task-remote.ts'

const endpoint = createSideTaskRemote().methods[SIDE_TASK_METHOD] as unknown as {
  input(options: { strict: boolean }): { create(): { parse(value: unknown): unknown } }
}

const strictSchema = endpoint.input({ strict: true }).create()

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
