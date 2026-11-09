/**
 * Target picker for "send this annotation to another conversation".
 *
 * Body-portalled and, on touch, laid out as a bottom sheet. The root carries
 * `data-dsq-menu` so the selection watcher treats presses inside it as our own
 * chrome instead of "clicked the blank page".
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePopover } from '../dom/popoverPlacement.ts'
import { activeLocale, t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from '../ui/icons.tsx'
import { useLocale } from '../useLocale.ts'
import {
  flattenTargets,
  relativeTime,
  targetId,
  type TargetDirectory,
  type TargetSession,
} from './session-targets.ts'
import { TARGET_PICKER_ATTRIBUTES } from './picker-surface.ts'

const GAP = 4
/** Search appears only once the list is long enough to be worth filtering. */
const SEARCH_THRESHOLD = 8

export interface SessionTargetPickerProps {
  readonly directory: TargetDirectory
  /** Latched by the caller so typing in the composer cannot move the default. */
  readonly selectedId?: string
  /** Viewport point for the desktop popover; ignored on touch. */
  readonly x: number
  readonly y: number
  readonly touch: boolean
  readonly onPick: (target: TargetSession) => void
  readonly onClose: () => void
}

interface Section {
  readonly label: string | null
  readonly targets: readonly TargetSession[]
}

function labelOf(target: TargetSession): string {
  if (target.kind === 'new') return t('handoff.newSession')
  // The conversation being read: the picker's first row, and the default.
  if (target.kind === 'here') return t('annotate.here')
  return target.title
}

function metaOf(target: TargetSession): string {
  if (target.kind === 'new') {
    return target.workspaceTitle ?? t('handoff.currentWorkspace')
  }
  if (target.kind === 'here') return target.workspaceTitle ?? t('handoff.currentWorkspace')
  // The workspace name is the only disambiguator for duplicate titles.
  return target.workspaceTitle ?? ''
}

export function SessionTargetPicker({
  directory,
  selectedId,
  x,
  y,
  touch,
  onPick,
  onClose,
}: SessionTargetPickerProps): ReactNode {
  useLocale()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const composingRef = useRef(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null)
  const initial = selectedId ?? (directory.defaultTarget ? targetId(directory.defaultTarget) : '')
  const [selected, setSelected] = useState(initial)

  const sections = useMemo<readonly Section[]>(() => {
    const needle = filter.trim().toLowerCase()
    const keep = (target: TargetSession): boolean => {
      if (!needle) return true
      return `${labelOf(target)} ${target.workspaceTitle ?? ''}`.toLowerCase().includes(needle)
    }
    return [
      // The conversation being read comes first: it is the default, and the row
      // that keeps the passage where it is.
      ...(directory.here ? [{ label: null, targets: [directory.here] }] : []),
      ...(directory.newSession ? [{ label: null, targets: [directory.newSession] }] : []),
      { label: t('handoff.currentWorkspace'), targets: directory.current },
      { label: t('handoff.otherWorkspaces'), targets: directory.other },
      { label: t('handoff.ungrouped'), targets: directory.ungrouped },
    ]
      .map((section) => ({ label: section.label, targets: section.targets.filter(keep) }))
      .filter((section) => section.targets.length > 0)
  }, [directory, filter])

  const options = useMemo(() => sections.flatMap((section) => section.targets), [sections])
  const showSearch = flattenTargets(directory).length > SEARCH_THRESHOLD

  useLayoutEffect(() => {
    if (touch) return
    const el = rootRef.current
    if (!el) return
    const anchor = DOMRect.fromRect({ x, y, width: 0, height: 0 })
    const at = placePopover(anchor, { width: el.offsetWidth, height: el.offsetHeight }, 'bottom', GAP)
    setPlacement({ top: at.top, left: at.left })
  }, [touch, x, y])

  // Focus the latched row once the panel is placed; hidden nodes cannot focus.
  useLayoutEffect(() => {
    if (!touch && placement === null) return
    const id = selected || (options[0] ? targetId(options[0]) : '')
    optionRefs.current.get(id)?.focus({ preventScroll: true })
    // Only on mount: later selection changes follow the pointer/keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement])

  useEffect(() => {
    const inside = (node: EventTarget | null): boolean =>
      node instanceof Node && rootRef.current?.contains(node) === true
    const onPointerDown = (event: PointerEvent): void => {
      if (inside(event.target)) return
      onClose()
    }
    const onContextMenu = (event: Event): void => {
      if (inside(event.target)) event.preventDefault()
      else onClose()
    }
    const onScroll = (event: Event): void => {
      if (inside(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const choose = useCallback(
    (target: TargetSession) => {
      setSelected(targetId(target))
      onPick(target)
    },
    [onPick],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'Tab') {
        onClose()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
        return
      }
      // Arrow keys belong to the search field's caret while it has focus.
      if (event.target instanceof HTMLInputElement && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }
      if (options.length === 0) return
      event.preventDefault()
      const active = document.activeElement
      const index = options.findIndex((target) => optionRefs.current.get(targetId(target)) === active)
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : event.key === 'ArrowDown'
              ? (index + 1 + options.length) % options.length
              : (index - 1 + options.length) % options.length
      const target = options[next]
      if (!target) return
      setSelected(targetId(target))
      optionRefs.current.get(targetId(target))?.focus({ preventScroll: true })
    },
    [onClose, options],
  )

  const panel = (
    <div
      ref={rootRef}
      className={cx(A.col, styles.targetPicker)}
      role="dialog"
      aria-label={t('handoff.dialogAria')}
      data-dsq-menu="true"
      {...TARGET_PICKER_ATTRIBUTES}
      data-touch={touch ? 'true' : 'false'}
      style={touch ? undefined : { top: placement?.top ?? 0, left: placement?.left ?? 0, visibility: placement ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
    >
      <div className={cx(A.row, styles.targetHead)}>
        <span className={styles.targetHeading}>{t('handoff.title')}</span>
        <button
          type="button"
          className={cx(A.plain, A.gridMid, styles.chipPreviewAction)}
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <LucideIcon name="x" size={15} />
        </button>
      </div>
      {showSearch ? (
        <div className={cx(A.row, styles.targetSearchRow)}>
          <input
            className={styles.targetSearch}
            type="search"
            value={query}
            placeholder={t('handoff.searchPlaceholder')}
            aria-label={t('handoff.searchAria')}
            onChange={(event) => {
              setQuery(event.target.value)
              if (!composingRef.current) setFilter(event.target.value)
            }}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false
              setFilter(event.currentTarget.value)
            }}
          />
        </div>
      ) : null}
      <div className={cx(A.col, styles.targetList)} role="listbox" aria-label={t('handoff.dialogAria')}>
        {options.length === 0 ? (
          <div className={styles.targetEmpty}>{t('handoff.noTargets')}</div>
        ) : null}
        {sections.map((section, sectionIndex) => (
          <div key={`${section.label ?? 'new'}-${sectionIndex}`}>
            {section.label ? (
              <div className={styles.targetGroupLabel}>{section.label}</div>
            ) : null}
            {section.targets.map((target) => {
              const id = targetId(target)
              const isNew = target.kind === 'new'
              const isHere = target.kind === 'here'
              // Both pseudo rows read as one level: an icon, the accent label and
              // no timestamp.
              const pseudo = isNew || isHere
              return (
                <button
                  key={id}
                  ref={(node) => {
                    if (node) optionRefs.current.set(id, node)
                    else optionRefs.current.delete(id)
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected === id}
                  className={cx(A.row, styles.targetOption, pseudo && styles.targetNew)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(target)}
                  onPointerEnter={(event) => {
                    setSelected(id)
                    event.currentTarget.focus({ preventScroll: true })
                  }}
                >
                  {pseudo ? (
                    <LucideIcon name={isNew ? 'plus' : 'message-square'} size={14} />
                  ) : null}
                  <span className={cx(A.col, styles.targetOptionMain)}>
                    <span className={cx(styles.targetTitleMain, pseudo && styles.targetNew)}>
                      {labelOf(target)}
                    </span>
                    {metaOf(target) ? <span className={styles.targetMeta}>{metaOf(target)}</span> : null}
                  </span>
                  {!pseudo ? (
                    <span className={styles.targetTime}>
                      {relativeTime(target.updatedAt, Date.now(), activeLocale())}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
