import { describe, expect, it } from 'vitest'
import { rankByName } from './rank.ts'

const models = [
  { name: 'DeepSeek-V3.2' },
  { name: 'DeepSeek-R1' },
  { name: 'Claude Sonnet' },
  { name: 'deepseek-chat' },
]

const names = (query: string): string[] => rankByName(models, query).map((item) => item.name)

describe('rankByName', () => {
  it('keeps catalog order for an empty query', () => {
    expect(names('')).toEqual(models.map((item) => item.name))
  })

  it('matches case-insensitively and ranks a prefix first', () => {
    expect(names('deep')[0]).toBe('DeepSeek-V3.2')
  })

  it('matches an ordered subsequence across word boundaries', () => {
    expect(names('dschat')).toEqual(['deepseek-chat'])
  })

  it('drops non-matching entries', () => {
    expect(names('zzz')).toEqual([])
  })

  it('prefers shorter, better-aligned matches', () => {
    expect(names('r1')).toEqual(['DeepSeek-R1'])
  })
})
