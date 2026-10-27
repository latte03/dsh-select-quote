import { describe, expect, it } from 'vitest'
import { hasReleaseTag } from './label.ts'

const flash = { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' }

describe('hasReleaseTag', () => {
  it('tags the official Flash entry under both official providers', () => {
    expect(hasReleaseTag('deepseek-account', flash)).toBe(true)
    expect(hasReleaseTag('deepseek-official', flash)).toBe(true)
  })

  it('leaves other providers alone even with the same model', () => {
    expect(hasReleaseTag('step', flash)).toBe(false)
  })

  it('requires both the model id and the exact catalog name', () => {
    expect(hasReleaseTag('deepseek-account', { ...flash, id: 'deepseek-v4-flash' })).toBe(false)
    expect(hasReleaseTag('deepseek-account', { ...flash, name: 'DeepSeek Flash' })).toBe(false)
  })
})
