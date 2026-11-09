/**
 * The settings page's tab strip.
 *
 * Deliberately not the `Segmented` control used for the value pickers: those
 * are `role="radiogroup"` (a value is remembered), while this is navigation
 * between panels (`role="tablist"` + `aria-controls`). Sharing one component
 * would have to lie about the role to a screen reader.
 *
 * The moving indicator is measured from the live label, the same trick as the
 * segmented thumb: the active tab's box is read after layout and the highlight
 * travels to it with a transform, so a font or locale change cannot leave it
 * sitting between two tabs.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { styles } from '../styles.ts'
import {
  SETTINGS_GROUPS,
  panelId,
  tabId,
  type SettingsGroupId,
} from './settingsGroups.ts'

export interface SettingsTabsProps {
  group: SettingsGroupId
  onSelect: (group: SettingsGroupId) => void
  t: (key: string) => string
}

export function SettingsTabs({ group, onSelect, t }: SettingsTabsProps): ReactNode {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const strip = stripRef.current
    if (strip === null) return
    const measure = (): void => {
      const active = strip.querySelector<HTMLElement>('[data-active="true"]')
      if (active === null) return
      const stripBox = strip.getBoundingClientRect()
      const box = active.getBoundingClientRect()
      const left = box.left - stripBox.left + strip.scrollLeft
      const { width } = box
      setIndicator((prev) =>
        prev !== null && prev.left === left && prev.width === width
          ? prev
          : { left, width },
      )
    }
    measure()
    // Fonts, a locale swap and the strip's own scroll all move the target
    // without changing the selected group.
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    strip.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      strip.removeEventListener('scroll', measure)
    }
  }, [group])

  /**
   * Arrow keys move the selection and the focus together (automatic
   * activation). With five short labels there is nothing to read between the
   * two, and the panel is the answer the user came for.
   */
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
      const last = SETTINGS_GROUPS.length - 1
      let next: number
      switch (event.key) {
        case 'ArrowRight':
          next = index === last ? 0 : index + 1
          break
        case 'ArrowLeft':
          next = index === 0 ? last : index - 1
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = last
          break
        default:
          return
      }
      event.preventDefault()
      const target = SETTINGS_GROUPS[next]
      onSelect(target.id)
      stripRef.current?.querySelector<HTMLElement>(`[data-tab="${target.id}"]`)?.focus()
    },
    [onSelect],
  )

  return (
    <div
      ref={stripRef}
      className={styles.tabsStrip}
      role="tablist"
      aria-label={t('settings.groupsAria')}
    >
      {indicator === null ? null : (
        <span
          className={styles.tabIndicator}
          aria-hidden="true"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
      )}
      {SETTINGS_GROUPS.map((item, index) => {
        const active = item.id === group
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            data-active={active}
            id={tabId(item.id)}
            aria-selected={active}
            aria-controls={active ? panelId(item.id) : undefined}
            // Roving tabindex: Tab reaches the strip once, arrows move inside.
            tabIndex={active ? 0 : -1}
            className={styles.tab}
            onClick={() => {
              if (!active) onSelect(item.id)
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {t(item.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
