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
    })
    expect(normalizeConfig({ shortcut: true })).toEqual({
      triggerMode: 'auto',
      toolbarPlacement: 'above',
      shortcut: true,
      sideTaskMode: 'separate',
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
