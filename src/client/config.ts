/**
 * Settings the Host owns.
 *
 * The browser half never receives `apply(ctx, config)`: Host builds the client
 * entry without it. The live values come from the shared config-form store,
 * keyed by the Loader row id (`configForms.get(ROW_ID)`), and are normalized
 * here so a missing service, a loading form, or a value written by hand all
 * collapse to the same defaults.
 *
 * `triggerMode` gates entry points; `shortcut` belongs to the keyboard entry.
 * `toolbarPlacement` picks the side of the selected text the auto toolbar hangs
 * on. Only volatile fields reach this store — that is also why every Host field
 * is declared `.volatile()`.
 */

export type TriggerMode = 'auto' | 'contextmenu' | 'both'

/** Preferred side of the first selected line for the floating toolbar. */
export type ToolbarPlacement = 'above' | 'below'

/** One side-task child per parent session, or a fresh fork for every question. */
export type SideTaskMode = 'separate' | 'reuse'

import { isTranslateTarget, type TranslateTarget } from './translate.ts'

/** Translation target: `auto` follows the UI language per selection. */
export type { TranslateTarget }

export interface SelectQuoteConfig {
  triggerMode: TriggerMode
  toolbarPlacement: ToolbarPlacement
  /**
   * Put our actions inside the Host's selection surface instead of raising a
   * second overlay next to it. Our own entry then owns the `quote` cell, so the
   * Host's quote button is ours to render (see `HostQuoteSurface`).
   */
  mergeHostSurface: boolean
  shortcut: boolean
  /** Show the Copy entry in the selection toolbar and right-click menu. */
  showCopy: boolean
  /** Show the Translate entry in the selection toolbar and right-click menu. */
  showTranslate: boolean
  /** Show the side-task question entry. */
  showAskInSide: boolean
  /**
   * Show the annotation entry, chevron and destination rows included. This is
   * the plugin's own action — with every switch off the toolbar would carry
   * nothing but the gear, which is the same as not having the plugin.
   */
  showAnnotate: boolean
  /**
   * Draw the action labels.
   *
   * Off leaves icons only, with the name on hover. On does not *promise* labels:
   * a row wider than the column still collapses (see `host-surface-fit.ts`), so
   * this switch can only take wording away, never make it overflow.
   */
  showButtonText: boolean
  sideTaskMode: SideTaskMode
  translateTarget: TranslateTarget
  /** Hide the translate entry when the selection already is the target language. */
  translateHideSameLanguage: boolean
  /** Empty provider+model pair follows the conversation's own route. */
  translateProvider: string
  translateModel: string
  /** Empty prompt uses the built-in translator instructions. */
  translatePrompt: string
}

export const DEFAULT_CONFIG: Readonly<SelectQuoteConfig> = Object.freeze({
  triggerMode: 'auto',
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

const TRIGGER_MODES: ReadonlySet<string> = new Set<TriggerMode>([
  'auto',
  'contextmenu',
  'both',
])

const TOOLBAR_PLACEMENTS: ReadonlySet<string> = new Set<ToolbarPlacement>(['above', 'below'])

const SIDE_TASK_MODES: ReadonlySet<string> = new Set<SideTaskMode>(['separate', 'reuse'])

/** The four per-button switches the settings page shows. */
export type ButtonSwitch = 'showCopy' | 'showTranslate' | 'showAskInSide' | 'showAnnotate'

export const BUTTON_SWITCHES: readonly ButtonSwitch[] = [
  'showAnnotate',
  'showCopy',
  'showTranslate',
  'showAskInSide',
]

/** True when at least one selection button would still be painted. */
export function hasAnyButton(config: Readonly<Record<ButtonSwitch, boolean>>): boolean {
  return BUTTON_SWITCHES.some((key) => config[key])
}

/**
 * Keep the selection row from emptying out.
 *
 * Every switch off leaves the toolbar with nothing but the gear and the Host's
 * pill with only its own quote cell — indistinguishable from an uninstalled
 * plugin, and there is no button left to explain why. So the last switch that
 * is still on cannot be turned off: the stored value stays, and the settings
 * row says which one it is instead of silently reverting.
 */
/** A switch keeps its value only when the form really sent a boolean. */
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function keepOneButton(
  switches: Record<ButtonSwitch, boolean>,
): Record<ButtonSwitch, boolean> {
  if (hasAnyButton(switches)) return switches
  return { ...switches, showAnnotate: true }
}

/** Which entry points the current mode turns on. */
export interface TriggerPlan {
  auto: boolean
  contextMenu: boolean
  shortcut: boolean
}

/** Collapse an untrusted snapshot value onto the known shape. */
export function normalizeConfig(value: unknown): SelectQuoteConfig {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_CONFIG }
  const record = value as Record<string, unknown>
  const switches = keepOneButton({
    showCopy: bool(record.showCopy, DEFAULT_CONFIG.showCopy),
    showTranslate: bool(record.showTranslate, DEFAULT_CONFIG.showTranslate),
    showAskInSide: bool(record.showAskInSide, DEFAULT_CONFIG.showAskInSide),
    showAnnotate: bool(record.showAnnotate, DEFAULT_CONFIG.showAnnotate),
  })
  return {
    triggerMode: TRIGGER_MODES.has(record.triggerMode as string)
      ? (record.triggerMode as TriggerMode)
      : DEFAULT_CONFIG.triggerMode,
    toolbarPlacement: TOOLBAR_PLACEMENTS.has(record.toolbarPlacement as string)
      ? (record.toolbarPlacement as ToolbarPlacement)
      : DEFAULT_CONFIG.toolbarPlacement,
    mergeHostSurface:
      typeof record.mergeHostSurface === 'boolean'
        ? record.mergeHostSurface
        : DEFAULT_CONFIG.mergeHostSurface,
    shortcut:
      typeof record.shortcut === 'boolean' ? record.shortcut : DEFAULT_CONFIG.shortcut,
    showCopy: switches.showCopy,
    showTranslate: switches.showTranslate,
    showAskInSide: switches.showAskInSide,
    showAnnotate: switches.showAnnotate,
    showButtonText: bool(record.showButtonText, DEFAULT_CONFIG.showButtonText),
    sideTaskMode: SIDE_TASK_MODES.has(record.sideTaskMode as string)
      ? (record.sideTaskMode as SideTaskMode)
      : DEFAULT_CONFIG.sideTaskMode,
    translateTarget: isTranslateTarget(record.translateTarget)
      ? record.translateTarget
      : DEFAULT_CONFIG.translateTarget,
    translateHideSameLanguage:
      typeof record.translateHideSameLanguage === 'boolean'
        ? record.translateHideSameLanguage
        : DEFAULT_CONFIG.translateHideSameLanguage,
    translateProvider:
      typeof record.translateProvider === 'string'
        ? record.translateProvider
        : DEFAULT_CONFIG.translateProvider,
    translateModel:
      typeof record.translateModel === 'string'
        ? record.translateModel
        : DEFAULT_CONFIG.translateModel,
    translatePrompt:
      typeof record.translatePrompt === 'string'
        ? record.translatePrompt
        : DEFAULT_CONFIG.translatePrompt,
  }
}

export function resolveTriggers(
  config: Pick<SelectQuoteConfig, 'triggerMode' | 'shortcut'>,
): TriggerPlan {
  return {
    auto: config.triggerMode === 'auto' || config.triggerMode === 'both',
    contextMenu: config.triggerMode === 'contextmenu' || config.triggerMode === 'both',
    shortcut: config.shortcut,
  }
}

let current: SelectQuoteConfig = { ...DEFAULT_CONFIG }
const listeners = new Set<() => void>()

export function getConfig(): SelectQuoteConfig {
  return current
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Every field participates in change detection — see `publishConfig`. */
const CONFIG_KEYS = Object.freeze(Object.keys(DEFAULT_CONFIG) as (keyof SelectQuoteConfig)[])

/** Publish a snapshot value; returns the normalized config actually stored. */
export function publishConfig(value: unknown): SelectQuoteConfig {
  const next = normalizeConfig(value)
  // Structural, not a hand-written field list: a new field that is left out of a
  // hand-maintained comparison silently never reaches the views (the label
  // switch landed exactly like that).
  if (CONFIG_KEYS.every((key) => next[key] === current[key])) return current
  current = next
  for (const listener of [...listeners]) listener()
  return current
}

/** The slice of a Host config form this half depends on. */
export interface ConfigFormSource {
  getSnapshot(): { value?: unknown }
  subscribe(listener: () => void): () => void
}

/**
 * Follow one Host config form. Works with a live form and with the fake one in
 * `verify`; the caller owns disposal.
 */
export function attachConfigForm(form: ConfigFormSource): () => void {
  const publish = (): void => {
    publishConfig(form.getSnapshot().value)
  }
  publish()
  const off = form.subscribe(publish)
  return () => {
    off()
    // The service is gone: fall back to the defaults it was overriding.
    publishConfig(undefined)
  }
}
