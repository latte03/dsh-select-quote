import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePopover, type PopoverPlacement } from '../dom/popoverPlacement.ts'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from '../ui/icons.tsx'
import type { SelectionActionEntry } from './actions.ts'

export interface SelectionMenuProps {
  /** The same ordered entries the toolbar renders, bound to the latched range. */
  entries: readonly SelectionActionEntry[]
  /** Viewport point the menu's top-left corner anchors to. */
  x: number
  y: number
  /** Dismissed without an action (outside press, Escape, scroll). */
  onClose(): void
  /** Keyboard commands focus the first item; a pointer opens on the menu itself. */
  initialFocus?: 'first' | 'menu'
}

/** Space between the anchor line's bottom and the menu. */
const ANCHOR_GAP = 2

export function SelectionMenu({
  entries,
  x,
  y,
  onClose,
  initialFocus = 'first',
}: SelectionMenuProps): ReactNode {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const firstRef = useRef<HTMLButtonElement | null>(null)
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null)

  // Measure before the first paint: the menu is invisible until it has a
  // placement, so it never flashes at the document origin.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const anchor = DOMRect.fromRect({ x, y, width: 0, height: 0 })
    setPlacement(
      placePopover(
        anchor,
        { width: el.offsetWidth, height: el.offsetHeight },
        'bottom',
        ANCHOR_GAP,
      ),
    )
  }, [x, y, entries.length])

  // A keyboard command lands on the first item so Enter works immediately. A
  // pointer open focuses the menu itself: no item should look selected before
  // the user points at one. Both wait for the placement commit, because a
  // `visibility: hidden` element cannot take focus.
  useLayoutEffect(() => {
    if (!placement) return
    if (initialFocus === 'menu') rootRef.current?.focus({ preventScroll: true })
    else firstRef.current?.focus({ preventScroll: true })
  }, [placement, initialFocus])

  useEffect(() => {
    const inside = (node: EventTarget | null): boolean =>
      node instanceof Node && rootRef.current?.contains(node) === true
    const onPointerDown = (event: PointerEvent): void => {
      if (inside(event.target)) return
      onClose()
    }
    const onContextMenu = (event: Event): void => {
      if (inside(event.target)) {
        // Our own surface owns this click; the browser has no business
        // painting a second menu over it.
        event.preventDefault()
        return
      }
      onClose()
    }
    const onScroll = (): void => onClose()
    const onResize = (): void => onClose()
    const onBlur = (): void => onClose()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onBlur)
    }
  }, [onClose])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'Tab') {
        // A menu is not a focus trap: leaving dismisses it and lets focus go.
        onClose()
        return
      }
      const step =
        event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step === 0 && event.key !== 'Home' && event.key !== 'End') return
      const buttons = [
        ...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
      ]
      if (buttons.length === 0) return
      event.preventDefault()
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const fromMenu = current === -1
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : fromMenu
              ? (step > 0 ? 0 : buttons.length - 1)
              : (current + step + buttons.length) % buttons.length
      buttons[next]?.focus({ preventScroll: true })
    },
    [onClose],
  )

  // Keep the text selection alive while the pointer is on a menu item: the
  // default press would move focus (and collapse the range) before the click.
  const keepSelection = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
  }, [])

  return createPortal(
    <div
      ref={rootRef}
      className={cx(A.col, styles.ctxMenu)}
      role="menu"
      aria-label={t('menu.aria')}
      data-dsq-menu="true"
      data-side={placement?.side ?? 'bottom'}
      tabIndex={-1}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        visibility: placement ? 'visible' : 'hidden',
      }}
      onKeyDown={handleKeyDown}
    >
      {entries.map((entry, index) => (
        <button
          key={entry.key}
          ref={index === 0 ? firstRef : undefined}
          type="button"
          role="menuitem"
          className={cx(A.plain, A.row, styles.ctxItem)}
          tabIndex={-1}
          onPointerDown={keepSelection}
          onPointerEnter={(event) => event.currentTarget.focus({ preventScroll: true })}
          onClick={entry.onClick}
        >
          <LucideIcon name={entry.icon} size={15} />
          <span>{entry.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
