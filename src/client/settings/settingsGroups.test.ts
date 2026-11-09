import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../config.ts'
import { DICTIONARIES } from '../i18n.ts'
import {
  DEFAULT_SETTINGS_GROUP,
  SETTINGS_GROUPS,
  isSettingsGroupId,
  panelId,
  tabId,
} from './settingsGroups.ts'

describe('settings groups', () => {
  /**
   * The reason this table is a module rather than inline JSX: a field with no
   * tab is invisible, and verify only greps the bundle for control names, so
   * nothing else would notice. Every key of the config belongs to exactly one
   * tab.
   */
  it('gives every config field exactly one tab', () => {
    const fields = SETTINGS_GROUPS.flatMap((group) => group.fields)
    expect(new Set(fields).size, 'a field appears in two tabs').toBe(fields.length)
    expect([...fields].sort()).toEqual(Object.keys(DEFAULT_CONFIG).sort())
  })

  it('keeps the tab order and ids stable', () => {
    expect(SETTINGS_GROUPS.map((group) => group.id)).toEqual([
      'entry',
      'buttons',
      'translate',
      'side',
      'shortcut',
    ])
    const labels = SETTINGS_GROUPS.map((group) => group.labelKey)
    expect(new Set(labels).size).toBe(labels.length)
    for (const key of labels) {
      expect(DICTIONARIES.en[key], `${key} is missing from the dictionaries`).toBeTypeOf('string')
      expect(DICTIONARIES.en[key]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('opens on a tab that exists and ignores stored junk', () => {
    expect(isSettingsGroupId(DEFAULT_SETTINGS_GROUP)).toBe(true)
    expect(isSettingsGroupId('nope')).toBe(false)
    expect(isSettingsGroupId(undefined)).toBe(false)
    expect(isSettingsGroupId(0)).toBe(false)
  })

  it('gives each tab a control target of its own panel', () => {
    for (const group of SETTINGS_GROUPS) {
      expect(tabId(group.id)).toBe(`dsq-tab-${group.id}`)
      expect(panelId(group.id)).toBe(`dsq-panel-${group.id}`)
      expect(tabId(group.id)).not.toBe(panelId(group.id))
    }
  })
})
