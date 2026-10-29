import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  normalizeConfig,
  type SideTaskMode,
  type ToolbarPlacement,
  type TriggerMode,
} from '../config.ts'
import { t as translate } from '../i18n.ts'
import { getShortcutRows, subscribeShortcutRows } from '../shortcut-menu.ts'
import { styles } from '../styles.ts'
import { useLocale } from '../useLocale.ts'

/** The live Host form for this plugin's Loader row, injected by the bundle slot. */
export interface ConfigFormController {
  getSnapshot(): { value?: unknown }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

export interface ConfigRowProps {
  /** The Plugins page renders the bundle section with `view: 'page'`. */
  view?: string
  form?: ConfigFormController
  /** Translator bound to this slot's locale seat. */
  t?: (key: string) => string
}

const CHOICES: readonly TriggerMode[] = ['auto', 'contextmenu', 'both']
const PLACEMENT_CHOICES: readonly ToolbarPlacement[] = ['above', 'below']
const SIDE_TASK_CHOICES: readonly SideTaskMode[] = ['separate', 'reuse']

/**
 * Segmented radio group whose selected cell is one sliding thumb. The thumb is
 * measured from the live label (not built from fixed widths), so it stays
 * aligned when the locale, font, or row width changes the label size.
 */
function Segmented<T extends string>({
  name,
  ariaLabel,
  choices,
  value,
  label,
  onChange,
}: {
  name: string
  ariaLabel: string
  choices: readonly T[]
  value: T
  label: (choice: T) => string
  onChange: (choice: T) => void
}): ReactNode {
  const groupRef = useRef<HTMLDivElement | null>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const measure = (): void => {
      const selected = group.querySelector<HTMLElement>('[data-active="true"]')
      if (!selected) return
      const groupRect = group.getBoundingClientRect()
      const rect = selected.getBoundingClientRect()
      const left = rect.left - groupRect.left
      const { width } = rect
      setThumb((prev) =>
        prev !== null && prev.left === left && prev.width === width
          ? prev
          : { left, width },
      )
    }
    measure()
    // Fonts and locale swaps resize the group without a value change.
    const observer = new ResizeObserver(measure)
    observer.observe(group)
    return () => observer.disconnect()
  }, [value, choices])

  return (
    <div ref={groupRef} className={styles.seg} role="radiogroup" aria-label={ariaLabel}>
      {thumb ? (
        <span
          className={styles.segThumb}
          aria-hidden="true"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      ) : null}
      {choices.map((choice) => {
        const active = choice === value
        return (
          <label key={choice} className={styles.segOption} data-active={active}>
            <input
              type="radio"
              className={styles.srOnly}
              name={name}
              value={choice}
              checked={active}
              onChange={() => {
                if (active) return
                // Each pick is the commit: the shared form persists it and
                // every open client (including this one) sees it live.
                onChange(choice)
              }}
            />
            <span>{label(choice)}</span>
          </label>
        )
      })}
    </div>
  )
}

export function ConfigRow({ view, form, t: slotTranslate }: ConfigRowProps): ReactNode {
  useLocale()
  if (view !== 'page' || form === undefined) return null
  return <ConfigSection form={form} slotTranslate={slotTranslate} />
}

/**
 * The bundle config entry gets no `form` prop from the Host (unlike a row
 * page), so it subscribes to the row's form controller itself. The controller
 * owns write ordering and revisions; `set` is the one-field convenience.
 */
function ConfigSection({
  form,
  slotTranslate,
}: {
  form: ConfigFormController
  slotTranslate?: (key: string) => string
}): ReactNode {
  const subscribe = useCallback((listener: () => void) => form.subscribe(listener), [form])
  const getSnapshot = useCallback(() => form.getSnapshot(), [form])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const current = normalizeConfig(snapshot.value)
  const shortcuts = useSyncExternalStore(
    subscribeShortcutRows,
    getShortcutRows,
    getShortcutRows,
  )
  const t = slotTranslate ?? translate

  return (
    <div className={styles.settings}>
      <div className={styles.settingsSection}>
        <div className={styles.settingsCopy}>
          <span className={styles.settingsLabel}>{t('settings.trigger')}</span>
          <span className={styles.settingsHint}>{t('settings.triggerHint')}</span>
        </div>
        <Segmented
          name="dsq-trigger-mode"
          ariaLabel={t('settings.trigger')}
          choices={CHOICES}
          value={current.triggerMode}
          label={(mode) => t(`settings.trigger.${mode}`)}
          onChange={(mode) => void form.set('triggerMode', mode)}
        />
      </div>
      {/* A right-click-only setup has no floating toolbar, so its side is not
          a meaningful choice; the row appears with auto / both. */}
      {current.triggerMode === 'contextmenu' ? null : (
        <div className={styles.settingsSection}>
          <div className={styles.settingsCopy}>
            <span className={styles.settingsLabel}>{t('settings.toolbarPlacement')}</span>
            <span className={styles.settingsHint}>{t('settings.toolbarPlacementHint')}</span>
          </div>
          <Segmented
            name="dsq-toolbar-placement"
            ariaLabel={t('settings.toolbarPlacement')}
            choices={PLACEMENT_CHOICES}
            value={current.toolbarPlacement}
            label={(placement) => t(`settings.toolbarPlacement.${placement}`)}
            onChange={(placement) => void form.set('toolbarPlacement', placement)}
          />
        </div>
      )}
      <div className={styles.settingsDivider} aria-hidden="true" />
      <label className={styles.settingsSwitchRow}>
        <span className={styles.settingsCopy}>
          <span className={styles.settingsLabel}>{t('settings.shortcut')}</span>
          <span className={styles.settingsHint}>{t('settings.shortcutHint')}</span>
        </span>
        <span className={styles.switch} data-on={current.shortcut}>
          <input
            type="checkbox"
            className={styles.srOnly}
            aria-label={t('settings.shortcut')}
            checked={current.shortcut}
            onChange={(event) => {
              const next = event.target.checked
              if (next === current.shortcut) return
              void form.set('shortcut', next)
            }}
          />
          <span className={styles.switchTrack} aria-hidden="true" />
        </span>
      </label>
      {current.shortcut ? (
        <ul className={styles.settingsShortcuts} aria-label={t('settings.shortcutListAria')}>
          {shortcuts.length === 0 ? (
            <li className={styles.settingsHint}>{t('settings.shortcutUnavailable')}</li>
          ) : (
            shortcuts.map((row) => (
              <li key={row.id} className={styles.settingsShortcutRow}>
                <span className={styles.settingsShortcutName}>{row.label}</span>
                <span className={styles.settingsShortcutKeys}>
                  {row.enabled ? (
                    row.keys.length > 0 ? (
                      <kbd className={styles.keycap}>{row.keys.join('')}</kbd>
                    ) : (
                      t('settings.shortcutUnbound')
                    )
                  ) : (
                    t('settings.shortcutConflict')
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <div className={styles.settingsDivider} aria-hidden="true" />
      <div className={styles.settingsSection}>
        <div className={styles.settingsCopy}>
          <span className={styles.settingsLabel}>{t('settings.sideTaskMode')}</span>
          <span className={styles.settingsHint}>{t('settings.sideTaskModeHint')}</span>
        </div>
        <Segmented
          name="dsq-side-task-mode"
          ariaLabel={t('settings.sideTaskMode')}
          choices={SIDE_TASK_CHOICES}
          value={current.sideTaskMode}
          label={(mode) => t(`settings.sideTaskMode.${mode}`)}
          onChange={(mode) => void form.set('sideTaskMode', mode)}
        />
      </div>
    </div>
  )
}
