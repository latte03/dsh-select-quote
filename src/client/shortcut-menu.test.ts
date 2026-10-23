import { describe, expect, it } from 'vitest'
import { ADD_TO_TASK_DEFAULTS, SELECTION_MENU_DEFAULTS } from './shortcut-menu.ts'

const PROFILES = [
  'desktop:macos',
  'desktop:windows',
  'desktop:linux',
  'web:macos',
  'web:windows',
  'web:linux',
] as const

describe('shortcut defaults', () => {
  it('defines both commands for every supported profile', () => {
    expect(Object.keys(SELECTION_MENU_DEFAULTS).sort()).toEqual([...PROFILES].sort())
    expect(Object.keys(ADD_TO_TASK_DEFAULTS).sort()).toEqual([...PROFILES].sort())
  })

  it('never lets the two commands share a binding', () => {
    for (const profile of PROFILES) {
      const menu = SELECTION_MENU_DEFAULTS[profile]
      const add = ADD_TO_TASK_DEFAULTS[profile]
      expect(`${menu.code}:${[...menu.modifiers].sort().join('+')}`).not.toBe(
        `${add.code}:${[...add.modifiers].sort().join('+')}`,
      )
    }
  })

  it('sticks to the combinations Web Linux actually admits', () => {
    expect(SELECTION_MENU_DEFAULTS['web:linux']).toEqual({
      code: 'Comma',
      modifiers: ['primary', 'shift'],
    })
    expect(ADD_TO_TASK_DEFAULTS['web:linux']).toEqual({
      code: 'Period',
      modifiers: ['primary', 'shift'],
    })
  })

  it('keeps the desktop macOS menu on the plain primary shortcut', () => {
    expect(SELECTION_MENU_DEFAULTS['desktop:macos']).toEqual({
      code: 'KeyL',
      modifiers: ['primary'],
    })
  })
})
