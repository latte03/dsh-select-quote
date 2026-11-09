import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  hasAnyButton,
  normalizeConfig,
  type ButtonSwitch,
  type SideTaskMode,
  type ToolbarPlacement,
  type TranslateTarget,
  type TriggerMode,
} from '../config.ts'
import { t as translate } from '../i18n.ts'
import { createGlobalModelDirectory } from '../model/globalDirectory.ts'
import { ModelSelect } from '../model/ModelSelect.tsx'
import type { ModelChoice } from '../model/types.ts'
import { runtime } from '../runtime.ts'
import { LanguageMenu } from '../selection/LanguageMenu.tsx'
import { getShortcutRows, subscribeShortcutRows } from '../shortcut-menu.ts'
import { styles } from '../styles.ts'
import { SettingsTabs } from './SettingsTabs.tsx'
import { SettingRow, SettingsNotice, SettingsPanel, SwitchRow } from './rows.tsx'
import { readStoredGroup, storeGroup, type SettingsGroupId } from './settingsGroups.ts'
import {
  DEFAULT_TRANSLATE_PROMPT,
  LANGUAGE_LABELS,
  TRANSLATE_LANGUAGES,
} from '../translate.ts'
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
  /**
   * The row controller, injected by this entry. Kept off the `form` prop name
   * because `PluginConfigViewProps.form` is the Host-owned page form; the
   * bundle page passes no form, so this entry brings its own.
   */
  configForm?: ConfigFormController
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

export function ConfigRow({ view, configForm, t: slotTranslate }: ConfigRowProps): ReactNode {
  useLocale()
  if (view !== 'page' || configForm === undefined) return null
  return <ConfigSection form={configForm} slotTranslate={slotTranslate} />
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

  const languageOptions = useMemo<readonly { value: TranslateTarget; label: string }[]>(
    () => [
      { value: 'auto', label: t('translate.auto') },
      ...TRANSLATE_LANGUAGES.map((code) => ({
        value: code,
        label: LANGUAGE_LABELS[code],
      })),
    ],
    [t],
  )
  // The settings page lives outside any session, so its picker reads the
  // Host-generation catalog instead of a session directory.
  const catalogue = useMemo(
    () =>
      createGlobalModelDirectory(async () => {
        const read = runtime.modelCatalog
        if (read !== undefined) return read()
        // Older shells without the global catalog can still offer the live
        // conversation's directory while that session is mounted.
        const sessionId = runtime.sessionId
        const directory =
          sessionId === undefined ? undefined : runtime.modelDirectoryFor?.(sessionId)
        if (directory === undefined) throw new Error('the model catalog is unavailable')
        await directory.load()
        return directory.store.getSnapshot().groups
      }),
    [],
  )
  const translateModel: ModelChoice | null =
    current.translateProvider.length > 0 && current.translateModel.length > 0
      ? { provider: current.translateProvider, model: current.translateModel }
      : null

  const [prompt, setPrompt] = useState(current.translatePrompt)
  const promptFocused = useRef(false)
  useEffect(() => {
    if (!promptFocused.current) setPrompt(current.translatePrompt)
  }, [current.translatePrompt])

  /**
   * True once the user tried to switch off the last button still on. The row
   * refuses and says why; `keepOneButton()` in `config.ts` is the same rule,
   * kept there so a stale form value cannot empty the row either.
   */
  const [keepOneNotice, setKeepOneNotice] = useState(false)
  /**
   * Which group is on screen. Remembered across visits: the slot unmounts when
   * the user leaves the plugins page, and a settings page is opened to change
   * one known thing — reopening on the first tab loses that thread.
   */
  const [group, setGroup] = useState<SettingsGroupId>(readStoredGroup)
  const selectGroup = useCallback((next: SettingsGroupId): void => {
    setGroup(next)
    storeGroup(next)
  }, [])
  /**
   * Every button switch goes through here instead of `form.set`: turning the
   * last one off would leave the toolbar with nothing but the gear and the
   * Host's pill with only its own quote cell — indistinguishable from a plugin
   * that is not installed, with no button left to click back to the settings.
   */
  const setSwitch = useCallback(
    async (field: ButtonSwitch, next: boolean): Promise<void> => {
      const remaining = { ...current, [field]: next }
      if (!next && !hasAnyButton(remaining)) {
        setKeepOneNotice(true)
        return
      }
      setKeepOneNotice(false)
      await form.set(field, next)
    },
    [current, form],
  )

  return (
    <div className={styles.settings}>
      <SettingsTabs group={group} onSelect={selectGroup} t={t} />
      {group === 'entry' ? (
        <SettingsPanel group="entry">
          <SettingRow label={t('settings.trigger')} hint={t('settings.triggerHint')}>
            <Segmented
              name="dsq-trigger-mode"
              ariaLabel={t('settings.trigger')}
              choices={CHOICES}
              value={current.triggerMode}
              label={(mode) => t(`settings.trigger.${mode}`)}
              onChange={(mode) => void form.set('triggerMode', mode)}
            />
          </SettingRow>
          {/* A right-click-only setup has no floating toolbar, so its side is not
              a meaningful choice; the row appears with auto / both. Merging into
              the Host's pill removes the toolbar for the same reason. */}
          {current.triggerMode === 'contextmenu' || current.mergeHostSurface ? null : (
            <SettingRow
              label={t('settings.toolbarPlacement')}
              hint={t('settings.toolbarPlacementHint')}
            >
              <Segmented
                name="dsq-toolbar-placement"
                ariaLabel={t('settings.toolbarPlacement')}
                choices={PLACEMENT_CHOICES}
                value={current.toolbarPlacement}
                label={(placement) => t(`settings.toolbarPlacement.${placement}`)}
                onChange={(placement) => void form.set('toolbarPlacement', placement)}
              />
            </SettingRow>
          )}
          <SwitchRow
            label={t('settings.mergeHostSurface')}
            hint={t('settings.mergeHostSurfaceHint')}
            on={current.mergeHostSurface}
            onChange={(next) => void form.set('mergeHostSurface', next)}
          />
        </SettingsPanel>
      ) : null}
      {group === 'buttons' ? (
        <SettingsPanel group="buttons">
          <span className={styles.settingsHint}>{t('settings.buttonsHint')}</span>
          <SwitchRow
            label={t('settings.showAnnotate')}
            hint={t('settings.showAnnotateHint')}
            on={current.showAnnotate}
            onChange={(next) => void setSwitch('showAnnotate', next)}
          />
          <SwitchRow
            label={t('settings.showCopy')}
            hint={t('settings.showCopyHint')}
            on={current.showCopy}
            onChange={(next) => void setSwitch('showCopy', next)}
          />
          <SwitchRow
            label={t('settings.showTranslate')}
            hint={t('settings.showTranslateHint')}
            on={current.showTranslate}
            onChange={(next) => void setSwitch('showTranslate', next)}
          />
          <SwitchRow
            label={t('settings.showAskInSide')}
            hint={t('settings.showAskInSideHint')}
            on={current.showAskInSide}
            onChange={(next) => void setSwitch('showAskInSide', next)}
          />
          {keepOneNotice ? <SettingsNotice text={t('settings.keepOneButton')} /> : null}
        </SettingsPanel>
      ) : null}
      {group === 'translate' ? (
        <SettingsPanel group="translate">
          <SettingRow
            label={t('settings.translateTarget')}
            hint={t('settings.translateTargetHint')}
          >
            <LanguageMenu
              value={current.translateTarget}
              options={languageOptions}
              ariaLabel={t('settings.translateTarget')}
              triggerClassName={styles.settingsSelect}
              onChange={(target) => void form.set('translateTarget', target)}
            />
          </SettingRow>
          <SwitchRow
            label={t('settings.translateHideSameLanguage')}
            hint={t('settings.translateHideSameLanguageHint')}
            on={current.translateHideSameLanguage}
            onChange={(next) => void form.set('translateHideSameLanguage', next)}
          />
          <SettingRow label={t('settings.translateModel')} hint={t('settings.translateModelHint')}>
            <div className={styles.settingsModel}>
              <ModelSelect
                directory={catalogue}
                value={translateModel}
                onChange={(choice) => {
                  // Two fields, two revisions; a partial write normalizes back to
                  // "follow the conversation" instead of pairing a wrong route.
                  void (async () => {
                    await form.set('translateProvider', choice?.provider ?? '')
                    await form.set('translateModel', choice?.model ?? '')
                  })()
                }}
              />
            </div>
          </SettingRow>
          <div className={styles.settingsField}>
            <div className={styles.settingsCopy}>
              <span className={styles.settingsLabel}>{t('settings.translatePrompt')}</span>
              <span className={styles.settingsHint}>{t('settings.translatePromptHint')}</span>
            </div>
            <textarea
              className={styles.settingsInput}
              value={prompt}
              maxLength={8000}
              aria-label={t('settings.translatePrompt')}
              placeholder={DEFAULT_TRANSLATE_PROMPT}
              onFocus={() => {
                promptFocused.current = true
              }}
              onBlur={() => {
                promptFocused.current = false
                if (prompt !== current.translatePrompt) {
                  void form.set('translatePrompt', prompt)
                }
              }}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
        </SettingsPanel>
      ) : null}
      {group === 'side' ? (
        <SettingsPanel group="side">
          <SettingRow label={t('settings.sideTaskMode')} hint={t('settings.sideTaskModeHint')}>
            <Segmented
              name="dsq-side-task-mode"
              ariaLabel={t('settings.sideTaskMode')}
              choices={SIDE_TASK_CHOICES}
              value={current.sideTaskMode}
              label={(mode) => t(`settings.sideTaskMode.${mode}`)}
              onChange={(mode) => void form.set('sideTaskMode', mode)}
            />
          </SettingRow>
        </SettingsPanel>
      ) : null}
      {group === 'shortcut' ? (
        <SettingsPanel group="shortcut">
          <SwitchRow
            label={t('settings.shortcut')}
            hint={t('settings.shortcutHint')}
            on={current.shortcut}
            onChange={(next) => void form.set('shortcut', next)}
          />
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
        </SettingsPanel>
      ) : null}
    </div>
  )
}
