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

export interface SelectQuoteConfig {
  triggerMode: TriggerMode
  toolbarPlacement: ToolbarPlacement
  shortcut: boolean
  sideTaskMode: SideTaskMode
}

export const DEFAULT_CONFIG: Readonly<SelectQuoteConfig> = Object.freeze({
  triggerMode: 'auto',
  toolbarPlacement: 'above',
  shortcut: false,
  sideTaskMode: 'separate',
})

const TRIGGER_MODES: ReadonlySet<string> = new Set<TriggerMode>([
  'auto',
  'contextmenu',
  'both',
])

const TOOLBAR_PLACEMENTS: ReadonlySet<string> = new Set<ToolbarPlacement>(['above', 'below'])

const SIDE_TASK_MODES: ReadonlySet<string> = new Set<SideTaskMode>(['separate', 'reuse'])

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
  return {
    triggerMode: TRIGGER_MODES.has(record.triggerMode as string)
      ? (record.triggerMode as TriggerMode)
      : DEFAULT_CONFIG.triggerMode,
    toolbarPlacement: TOOLBAR_PLACEMENTS.has(record.toolbarPlacement as string)
      ? (record.toolbarPlacement as ToolbarPlacement)
      : DEFAULT_CONFIG.toolbarPlacement,
    shortcut:
      typeof record.shortcut === 'boolean' ? record.shortcut : DEFAULT_CONFIG.shortcut,
    sideTaskMode: SIDE_TASK_MODES.has(record.sideTaskMode as string)
      ? (record.sideTaskMode as SideTaskMode)
      : DEFAULT_CONFIG.sideTaskMode,
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

/** Publish a snapshot value; returns the normalized config actually stored. */
export function publishConfig(value: unknown): SelectQuoteConfig {
  const next = normalizeConfig(value)
  if (
    next.triggerMode === current.triggerMode &&
    next.toolbarPlacement === current.toolbarPlacement &&
    next.shortcut === current.shortcut &&
    next.sideTaskMode === current.sideTaskMode
  ) {
    return current
  }
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
