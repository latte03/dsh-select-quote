/**
 * The recurring shapes of the settings page.
 *
 * Before this module the switch row was written out six times, the label /
 * hint / control row five times and the tab panel wrapper five times. They had
 * already drifted (one hint spanned two lines, one copy block had no hint), and
 * every animation tweak had to be applied in each copy.
 *
 * These are dumb views on purpose: no config reads, no writes, no state. The
 * guard rules (which switch may not be turned off, which value is persisted)
 * stay in `ConfigRow`, where the form controller lives.
 */

import type { ReactNode } from 'react'
import { styles } from '../styles.ts'
import { panelId, tabId, type SettingsGroupId } from './settingsGroups.ts'

/** One tab's panel. `aria-labelledby` points back at the tab that raised it. */
export function SettingsPanel({
  group,
  children,
}: {
  group: SettingsGroupId
  children: ReactNode
}): ReactNode {
  return (
    <div
      className={styles.group}
      role="tabpanel"
      id={panelId(group)}
      aria-labelledby={tabId(group)}
    >
      {children}
    </div>
  )
}

/** Copy on the left, a control on the right — the Host's own settings row. */
export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}): ReactNode {
  return (
    <div className={styles.settingsSection}>
      <div className={styles.settingsCopy}>
        <span className={styles.settingsLabel}>{label}</span>
        {hint === undefined ? null : <span className={styles.settingsHint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/**
 * A boolean row. The whole row is the hit target (the `<label>` wraps both the
 * text and the switch), so the 1×1 visually hidden checkbox never has to be
 * aimed at.
 */
export function SwitchRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  onChange: (next: boolean) => void
}): ReactNode {
  return (
    <label className={styles.settingsSwitchRow}>
      <span className={styles.settingsCopy}>
        <span className={styles.settingsLabel}>{label}</span>
        <span className={styles.settingsHint}>{hint}</span>
      </span>
      <span className={styles.switch} data-on={on}>
        <input
          type="checkbox"
          className={styles.srOnly}
          aria-label={label}
          checked={on}
          onChange={(event) => {
            const next = event.target.checked
            if (next === on) return
            onChange(next)
          }}
        />
        <span className={styles.switchTrack} aria-hidden="true" />
      </span>
    </label>
  )
}

/**
 * An inline explanation under the row that produced it. `role="status"` so a
 * refused action is announced, not just painted.
 */
export function SettingsNotice({ text }: { text: string }): ReactNode {
  return (
    <p className={styles.settingsNotice} role="status">
      {text}
    </p>
  )
}
