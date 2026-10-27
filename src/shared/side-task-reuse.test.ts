import { describe, expect, it } from 'vitest'
import { isNotResumable, reusableChildId } from './side-task-reuse.ts'

describe('reusableChildId', () => {
  it('is stable per parent and distinct across parents', () => {
    expect(reusableChildId('session-a')).toBe(reusableChildId('session-a'))
    expect(reusableChildId('session-a')).not.toBe(reusableChildId('session-b'))
  })

  it('looks like a session id, not a hash blob', () => {
    expect(reusableChildId('session-a')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

describe('isNotResumable', () => {
  it('recognizes the gateway code and the nested cause', () => {
    expect(isNotResumable({ code: 'subagent/not-resumable' })).toBe(true)
    expect(isNotResumable({ code: 'gateway/internal', cause: { code: 'NOT_RESUMABLE' } })).toBe(true)
  })

  it('does not treat other refusals as a missing child', () => {
    expect(isNotResumable({ code: 'subagent/delivery-unavailable' })).toBe(false)
    expect(isNotResumable(new Error('boom'))).toBe(false)
    expect(isNotResumable(undefined)).toBe(false)
  })
})
