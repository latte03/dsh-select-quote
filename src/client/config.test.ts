import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, hasAnyButton, normalizeConfig, resolveTriggers } from './config.ts'

describe('normalizeConfig', () => {
  it('falls back to the defaults for a missing or malformed snapshot', () => {
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig({ triggerMode: 'nope', shortcut: 'yes' })).toEqual(DEFAULT_CONFIG)
  })

  it('keeps known values and each field independently', () => {
    expect(normalizeConfig({ triggerMode: 'both' })).toEqual({
      triggerMode: 'both',
      toolbarPlacement: 'below',
      mergeHostSurface: false,
      shortcut: false,
      showCopy: true,
      showTranslate: true,
      showAskInSide: true,
      showAnnotate: true,
      showButtonText: true,
      sideTaskMode: 'separate',
      translateTarget: 'auto',
      translateHideSameLanguage: false,
      translateProvider: '',
      translateModel: '',
      translatePrompt: '',
    })
    expect(normalizeConfig({ shortcut: true })).toEqual({
      triggerMode: 'auto',
      toolbarPlacement: 'below',
      mergeHostSurface: false,
      shortcut: true,
      showCopy: true,
      showTranslate: true,
      showAskInSide: true,
      showAnnotate: true,
      showButtonText: true,
      sideTaskMode: 'separate',
      translateTarget: 'auto',
      translateHideSameLanguage: false,
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
    expect(normalizeConfig({ toolbarPlacement: 'left' }).toolbarPlacement).toBe('below')
  })

  it('keeps a known translation target and rejects unknown codes', () => {
    expect(normalizeConfig({ translateTarget: 'ja' }).translateTarget).toBe('ja')
    expect(normalizeConfig({ translateTarget: 'ko' }).translateTarget).toBe('auto')
  })

  it('keeps the hide-same-language switch only when boolean', () => {
    expect(normalizeConfig({ translateHideSameLanguage: true }).translateHideSameLanguage).toBe(
      true,
    )
    expect(
      normalizeConfig({ translateHideSameLanguage: 'yes' }).translateHideSameLanguage,
    ).toBe(false)
  })

  it('keeps the merge switch only when boolean', () => {
    expect(normalizeConfig({ mergeHostSurface: true }).mergeHostSurface).toBe(true)
    expect(normalizeConfig({ mergeHostSurface: 'yes' }).mergeHostSurface).toBe(false)
  })

  it('keeps the label switch only when boolean', () => {
    expect(normalizeConfig({ showButtonText: false }).showButtonText).toBe(false)
    expect(normalizeConfig({ showButtonText: 'no' }).showButtonText).toBe(true)
  })

  it('keeps each button switch only when boolean', () => {
    const off = normalizeConfig({
      showCopy: false,
      showTranslate: false,
      showAskInSide: false,
      showAnnotate: false,
    })
    // Four switches off would empty the toolbar, so normalisation keeps the
    // plugin's own action — the one the whole plugin exists for.
    expect([off.showCopy, off.showTranslate, off.showAskInSide, off.showAnnotate]).toEqual([
      false,
      false,
      false,
      true,
    ])
    const three = normalizeConfig({
      showCopy: false,
      showTranslate: false,
      showAskInSide: false,
    })
    expect([three.showCopy, three.showTranslate, three.showAskInSide, three.showAnnotate]).toEqual([
      false,
      false,
      false,
      true,
    ])
    const last = normalizeConfig({
      showCopy: false,
      showTranslate: true,
      showAskInSide: false,
      showAnnotate: false,
    })
    expect([last.showCopy, last.showTranslate, last.showAskInSide, last.showAnnotate]).toEqual([
      false,
      true,
      false,
      false,
    ])
    const malformed = normalizeConfig({ showCopy: 'no', showTranslate: 0, showAskInSide: null })
    expect([malformed.showCopy, malformed.showTranslate, malformed.showAskInSide]).toEqual([
      true,
      true,
      true,
    ])
  })

  it('reports which switches would still paint a button', () => {
    expect(hasAnyButton({ showCopy: false, showTranslate: false, showAskInSide: false, showAnnotate: true })).toBe(true)
    expect(hasAnyButton({ showCopy: false, showTranslate: false, showAskInSide: false, showAnnotate: false })).toBe(false)
    expect(hasAnyButton(DEFAULT_CONFIG)).toBe(true)
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
