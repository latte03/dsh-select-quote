import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { normalizeConfig, type SideTaskMode, type TriggerMode } from '../config.ts'
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
const SIDE_TASK_CHOICES: readonly SideTaskMode[] = ['separate', 'reuse']

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
        <div className={styles.seg} role="radiogroup" aria-label={t('settings.trigger')}>
          {CHOICES.map((mode) => {
            const active = mode === current.triggerMode
            return (
              <label key={mode} className={styles.segOption} data-active={active}>
                <input
                  type="radio"
                  className={styles.srOnly}
                  name="dsq-trigger-mode"
                  value={mode}
                  checked={active}
                  onChange={() => {
                    if (active) return
                    // Each pick is the commit: the shared form persists it and
                    // every open client (including this one) sees it live.
                    void form.set('triggerMode', mode)
                  }}
                />
                <span>{t(`settings.trigger.${mode}`)}</span>
              </label>
            )
          })}
        </div>
      </div>
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
        <div
          className={styles.seg}
          role="radiogroup"
          aria-label={t('settings.sideTaskMode')}
        >
          {SIDE_TASK_CHOICES.map((mode) => {
            const active = mode === current.sideTaskMode
            return (
              <label key={mode} className={styles.segOption} data-active={active}>
                <input
                  type="radio"
                  className={styles.srOnly}
                  name="dsq-side-task-mode"
                  value={mode}
                  checked={active}
                  onChange={() => {
                    if (active) return
                    void form.set('sideTaskMode', mode)
                  }}
                />
                <span>{t(`settings.sideTaskMode.${mode}`)}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
