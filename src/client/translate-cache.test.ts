import { beforeEach, describe, expect, it } from 'vitest'
import {
  TRANSLATE_CACHE_LIMIT,
  clearTranslationCache,
  readTranslation,
  writeTranslation,
  type TranslateCacheKey,
} from './translate-cache.ts'

const base: TranslateCacheKey = {
  text: 'Hello world',
  target: 'zh',
  provider: '',
  model: '',
  prompt: 'Translate into Simplified Chinese.',
  sessionId: 'session-main',
}

beforeEach(() => {
  clearTranslationCache()
})

describe('translate cache', () => {
  it('returns the finished translation for the same key', () => {
    writeTranslation(base, '你好，世界')
    expect(readTranslation({ ...base })).toBe('你好，世界')
  })

  it('misses when any output-changing input differs', () => {
    writeTranslation(base, '你好，世界')
    expect(readTranslation({ ...base, text: 'Hello world!' })).toBeUndefined()
    expect(readTranslation({ ...base, target: 'ja' })).toBeUndefined()
    expect(readTranslation({ ...base, provider: 'deepseek' })).toBeUndefined()
    expect(readTranslation({ ...base, model: 'fast' })).toBeUndefined()
    expect(readTranslation({ ...base, prompt: 'Translate literally.' })).toBeUndefined()
    expect(readTranslation({ ...base, sessionId: 'session-other' })).toBeUndefined()
  })

  it('caps the store and drops the least recently read entry', () => {
    for (let index = 0; index < TRANSLATE_CACHE_LIMIT; index += 1) {
      writeTranslation({ ...base, text: `passage ${index}` }, `result ${index}`)
    }
    // A hit counts as a use, so the second entry becomes the oldest.
    expect(readTranslation({ ...base, text: 'passage 0' })).toBe('result 0')
    writeTranslation({ ...base, text: 'fresh' }, 'fresh result')
    expect(readTranslation({ ...base, text: 'passage 0' })).toBe('result 0')
    expect(readTranslation({ ...base, text: 'passage 1' })).toBeUndefined()
    expect(readTranslation({ ...base, text: 'fresh' })).toBe('fresh result')
  })

  it('replaces the same key instead of growing', () => {
    writeTranslation(base, '旧译文')
    writeTranslation(base, '新译文')
    writeTranslation({ ...base, text: 'second' }, 'second result')
    writeTranslation({ ...base, text: 'third' }, 'third result')
    expect(readTranslation({ ...base })).toBe('新译文')
    expect(readTranslation({ ...base, text: 'third' })).toBe('third result')
  })

  it('ignores blank results', () => {
    writeTranslation(base, '   \n ')
    expect(readTranslation({ ...base })).toBeUndefined()
  })
})
