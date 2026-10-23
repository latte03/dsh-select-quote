/**
 * The keyboard entries into the selection actions, registered with the Host's
 * shortcut service.
 *
 * Registration is a live switch: the commands only exist while the user has
 * turned `shortcut` on, so the shortcut reference never lists a dead command.
 * Each command resolves against whatever selection the toolbar can see at press
 * time and reports "select text first" instead of acting on nothing.
 */

import type { Context } from '@deepseek-ai/cordis'
import { getConfig, subscribeConfig } from './config.ts'
import { t } from './i18n.ts'
import { runtime } from './runtime.ts'

export const SELECTION_MENU_COMMAND_ID = 'select-quote.openMenu'
export const ADD_TO_TASK_COMMAND_ID = 'select-quote.addToTask'

/**
 * Defaults per device profile.
 *
 * The two commands never share a binding. Web Linux admits only
 * `primary+Slash`, `primary+shift+Comma` and `primary+shift+Period`, and the
 * Host owns `primary+Slash` for its shortcut panel, so the menu takes comma and
 * add-to-task takes period. Web macOS/Windows accept two-modifier combinations;
 * theirs avoid the browser's own menu keys. Desktop Windows/Linux also take
 * period for add-to-task: `Ctrl+Alt+L` is AltGr+L on several layouts, and on
 * Windows the shell dispatches configured shortcuts before input regions.
 */
export const SELECTION_MENU_DEFAULTS = Object.freeze({
  'desktop:macos': Object.freeze({ code: 'KeyL', modifiers: Object.freeze(['primary']) }),
  'desktop:windows': Object.freeze({
    code: 'KeyL',
    modifiers: Object.freeze(['primary', 'shift']),
  }),
  'desktop:linux': Object.freeze({
    code: 'KeyL',
    modifiers: Object.freeze(['primary', 'shift']),
  }),
  'web:macos': Object.freeze({ code: 'KeyL', modifiers: Object.freeze(['primary', 'shift']) }),
  'web:windows': Object.freeze({ code: 'KeyL', modifiers: Object.freeze(['primary', 'shift']) }),
  'web:linux': Object.freeze({ code: 'Comma', modifiers: Object.freeze(['primary', 'shift']) }),
})

export const ADD_TO_TASK_DEFAULTS = Object.freeze({
  'desktop:macos': Object.freeze({ code: 'KeyL', modifiers: Object.freeze(['primary', 'shift']) }),
  'desktop:windows': Object.freeze({
    code: 'Period',
    modifiers: Object.freeze(['primary', 'shift']),
  }),
  'desktop:linux': Object.freeze({
    code: 'Period',
    modifiers: Object.freeze(['primary', 'shift']),
  }),
  'web:macos': Object.freeze({ code: 'KeyL', modifiers: Object.freeze(['primary', 'alt']) }),
  'web:windows': Object.freeze({ code: 'Period', modifiers: Object.freeze(['primary', 'shift']) }),
  'web:linux': Object.freeze({ code: 'Period', modifiers: Object.freeze(['primary', 'shift']) }),
})

type SelectionAction = 'open' | 'add'

function resolveSelectionAction(action: SelectionAction) {
  const bridge = runtime.selection
  if (!bridge) {
    return { status: 'blocked' as const, reason: t('menu.noSelection') }
  }
  const state = bridge.state()
  if (state === 'busy') {
    return { status: 'blocked' as const, reason: t('menu.busy') }
  }
  if (state === 'no-selection') {
    return { status: 'blocked' as const, reason: t('menu.noSelection') }
  }
  return { status: 'handled' as const, run: () => bridge[action]() }
}

export function selectionMenuCommand() {
  return {
    id: SELECTION_MENU_COMMAND_ID,
    label: () => t('menu.shortcutLabel'),
    aliases: ['selection menu', 'quote menu'],
    defaults: SELECTION_MENU_DEFAULTS,
    // The transcript is not editable: a press while the composer or another
    // input owns focus belongs to that input.
    regions: ['page'] as const,
    modals: [],
    resolve: () => resolveSelectionAction('open'),
  }
}

export function addToTaskCommand() {
  return {
    id: ADD_TO_TASK_COMMAND_ID,
    label: () => t('menu.addShortcutLabel'),
    aliases: ['add to task', 'annotate selection'],
    defaults: ADD_TO_TASK_DEFAULTS,
    regions: ['page'] as const,
    modals: [],
    resolve: () => resolveSelectionAction('add'),
  }
}

/** One live row for the settings page; keys are already keycap labels. */
export interface ShortcutRow {
  id: string
  label: string
  keys: readonly string[]
  enabled: boolean
}

let shortcutRows: readonly ShortcutRow[] = []
const shortcutListeners = new Set<() => void>()

export function getShortcutRows(): readonly ShortcutRow[] {
  return shortcutRows
}

export function subscribeShortcutRows(listener: () => void): () => void {
  shortcutListeners.add(listener)
  return () => {
    shortcutListeners.delete(listener)
  }
}

function publishShortcutRows(next: readonly ShortcutRow[]): void {
  const unchanged =
    next.length === shortcutRows.length &&
    next.every((row, index) => {
      const previous = shortcutRows[index]
      return (
        previous.id === row.id &&
        previous.label === row.label &&
        previous.enabled === row.enabled &&
        previous.keys.length === row.keys.length &&
        previous.keys.every((key, keyIndex) => key === row.keys[keyIndex])
      )
    })
  if (unchanged) return
  shortcutRows = next
  for (const listener of [...shortcutListeners]) listener()
}

/**
 * Mirror the two live catalog rows. The Host drops a command from the catalog
 * while it is unregistered, and marks a rebound conflict; the settings page
 * reads this instead of restating the defaults.
 */
function publishShortcutCatalog(ctx: Context): void {
  const catalog = ctx.shortcuts.catalog.getSnapshot()
  const next: ShortcutRow[] = []
  for (const id of [SELECTION_MENU_COMMAND_ID, ADD_TO_TASK_COMMAND_ID]) {
    const row = catalog.find((candidate) => candidate.id === id)
    if (!row) continue
    next.push({
      id,
      label: row.label,
      keys: row.keys,
      enabled: row.issue === null && row.conflicts.length === 0,
    })
  }
  publishShortcutRows(next)
}

/** Keep both commands registered exactly while the setting is on. */
export function installSelectionShortcut(ctx: Context): void {
  const disposers: Array<() => void> = []
  const unregisterAll = (): void => {
    while (disposers.length > 0) disposers.pop()?.()
  }

  const sync = (): void => {
    unregisterAll()
    if (!getConfig().shortcut) return
    for (const command of [selectionMenuCommand(), addToTaskCommand()]) {
      try {
        disposers.push(ctx.shortcuts.register(command))
      } catch (error) {
        // A binding owned by another plugin must not take the whole plugin
        // down; the menu and the toolbars keep working without this entry.
        console.warn(`[dsh-select-quote] shortcut registration failed for ${command.id}:`, error)
      }
    }
  }

  ctx.effect(() => {
    const syncCatalog = (): void => publishShortcutCatalog(ctx)
    syncCatalog()
    const offCatalog = ctx.shortcuts.catalog.subscribe(syncCatalog)
    sync()
    const off = subscribeConfig(sync)
    return () => {
      off()
      offCatalog()
      unregisterAll()
      publishShortcutRows([])
    }
  }, 'dsh-select-quote: shortcut commands')
}
