/**
 * How the plugin settings page is split into tabs.
 *
 * One tab per question a user arrives with ("where do I change translation?"),
 * so a field that answers two questions has to pick one — see the notes on
 * `mergeHostSurface` below.
 *
 * The table lives apart from the view so `settingsGroups.test.ts` can walk the
 * config schema against it: a field added to `DEFAULT_CONFIG` without a home
 * here ends up with no tab at all, and a static check in verify cannot see that
 * (it only greps the built bundle for control names).
 */

export type SettingsGroupId = 'entry' | 'buttons' | 'translate' | 'side' | 'shortcut'

export interface SettingsGroup {
  readonly id: SettingsGroupId
  /** Dictionary key of the tab label. */
  readonly labelKey: string
  /** Config fields the tab renders, in on-screen order. */
  readonly fields: readonly string[]
}

/**
 * Frequency order: the rows people actually change come first, because a tab
 * strip is scanned left to right before anything is clicked.
 */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'entry',
    labelKey: 'settings.groupEntry',
    // `mergeHostSurface` sits here, not with the buttons: it answers "does our
    // toolbar exist as its own bar at all", the same question as placement.
    // Hiding it with the button switches made it look like a per-button choice.
    fields: ['triggerMode', 'toolbarPlacement', 'mergeHostSurface'],
  },
  {
    id: 'buttons',
    labelKey: 'settings.groupButtons',
    fields: ['showAnnotate', 'showCopy', 'showTranslate', 'showAskInSide', 'showButtonText'],
  },
  {
    id: 'translate',
    labelKey: 'settings.groupTranslate',
    // The model picker writes two fields but is one row; both are listed so
    // coverage stays exact.
    fields: [
      'translateTarget',
      'translateHideSameLanguage',
      'translateProvider',
      'translateModel',
      'translatePrompt',
    ],
  },
  { id: 'side', labelKey: 'settings.groupSide', fields: ['sideTaskMode'] },
  { id: 'shortcut', labelKey: 'settings.groupShortcut', fields: ['shortcut'] },
]

export const DEFAULT_SETTINGS_GROUP: SettingsGroupId = 'entry'

/**
 * Which tab this client last looked at. A settings page is visited to change
 * one thing, so reopening on the first tab throws away that context; the slot
 * unmounts whenever the user leaves the plugins page, so component state alone
 * would reset every time.
 */
export const SETTINGS_GROUP_STORAGE_KEY = 'dsh-select-quote.settings-group'

export function isSettingsGroupId(value: unknown): value is SettingsGroupId {
  return SETTINGS_GROUPS.some((group) => group.id === value)
}

/** Read the remembered tab; storage failures fall back to the first one. */
export function readStoredGroup(): SettingsGroupId {
  try {
    const value = globalThis.localStorage?.getItem(SETTINGS_GROUP_STORAGE_KEY)
    return isSettingsGroupId(value) ? value : DEFAULT_SETTINGS_GROUP
  } catch {
    return DEFAULT_SETTINGS_GROUP
  }
}

export function storeGroup(group: SettingsGroupId): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_GROUP_STORAGE_KEY, group)
  } catch {
    // A blocked store only costs the memory of which tab was open.
  }
}

/** Stable ids so the strip's `aria-controls` reaches the panel it switched to. */
export function tabId(group: SettingsGroupId): string {
  return `dsq-tab-${group}`
}

export function panelId(group: SettingsGroupId): string {
  return `dsq-panel-${group}`
}
