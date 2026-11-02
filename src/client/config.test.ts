import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig, resolveTriggers } from './config.ts'

describe('normalizeConfig', () => {
  it('falls back to the defaults for a missing or malformed snapshot', () => {
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig({ triggerMode: 'nope', shortcut: 'yes' })).toEqual(DEFAULT_CONFIG)
  })

  it('keeps known values and each field independently', () => {
    expect(normalizeConfig({ triggerMode: 'both' })).toEqual({
      triggerMode: 'both',
      toolbarPlacement: 'above',
      shortcut: false,
      sideTaskMode: 'separate',
      translateTarget: 'auto',
      translateProvider: '',
      translateModel: '',
      translatePrompt: '',
    })
    expect(normalizeConfig({ shortcut: true })).toEqual({
      triggerMode: 'auto',
      toolbarPlacement: 'above',
      shortcut: true,
      sideTaskMode: 'separate',
      translateTarget: 'auto',
      translateProvider: '',
      translateModel: '',
      translatePrompt: '',
    })
  })

  it('accepts both side-task modes and rejects unknown ones', () => {
    expect(normalizeConfig({ sideTaskMode: 'reuse' }).sideTaskMode).toBe('reuse')
    expect(normalizeConfig({ sideTaskMode: 'shared' }).sideTaskMode).toBe('separate')
  })

  it('accepts both toolbar sides and rejects unknown ones', () => {
    expect(normalizeConfig({ toolbarPlacement: 'below' }).toolbarPlacement).toBe('below')
    expect(normalizeConfig({ toolbarPlacement: 'left' }).toolbarPlacement).toBe('above')
  })

  it('keeps a known translation target and rejects unknown codes', () => {
    expect(normalizeConfig({ translateTarget: 'ja' }).translateTarget).toBe('ja')
    expect(normalizeConfig({ translateTarget: 'ko' }).translateTarget).toBe('auto')
  })

  it('keeps the translation route and prompt only when they are strings', () => {
    const config = normalizeConfig({
      translateProvider: 'deepseek-account',
      translateModel: 'deepseek-v4-pro',
      translatePrompt: 'Translate into {target}.',
    })
    expect(config.translateProvider).toBe('deepseek-account')
    expect(config.translateModel).toBe('deepseek-v4-pro')
    expect(config.translatePrompt).toBe('Translate into {target}.')

    const malformed = normalizeConfig({
      translateProvider: 7,
      translateModel: null,
      translatePrompt: ['x'],
    })
    expect(malformed.translateProvider).toBe('')
    expect(malformed.translateModel).toBe('')
    expect(malformed.translatePrompt).toBe('')
  })
})

describe('resolveTriggers', () => {
  it.each([
    ['auto', { auto: true, contextMenu: false, shortcut: false }],
    ['contextmenu', { auto: false, contextMenu: true, shortcut: false }],
    ['both', { auto: true, contextMenu: true, shortcut: false }],
  ] as const)('maps %s to its entry points', (triggerMode, want) => {
    expect(resolveTriggers({ triggerMode, shortcut: false })).toEqual(want)
  })

  it('keeps the shortcut switch independent of the trigger mode', () => {
    expect(resolveTriggers({ triggerMode: 'both', shortcut: true })).toEqual({
      auto: true,
      contextMenu: true,
      shortcut: true,
    })
  })
})
