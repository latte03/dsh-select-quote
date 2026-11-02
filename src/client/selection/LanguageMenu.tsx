/**
 * Compact language dropdown shared by the translation popover and the settings
 * page. A portal keeps it from being clipped by the transcript layer or the
 * plugin page's own scroll container; `data-dsq-menu` tells the selection
 * watcher that a press here belongs to the plugin, not to the page.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePopover } from '../dom/popoverPlacement.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from '../ui/icons.tsx'

export interface LanguageOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface LanguageMenuProps<T extends string> {
  readonly value: T
  readonly options: readonly LanguageOption<T>[]
  readonly ariaLabel: string
  readonly onChange: (value: T) => void
  /** Extra class for the trigger (the settings page uses a field-sized one). */
  readonly triggerClassName?: string
}

const ANCHOR_GAP = 4

export function LanguageMenu<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
  triggerClassName,
}: LanguageMenuProps<T>): ReactNode {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const current = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (trigger === null || menu === null) return
    const rect = trigger.getBoundingClientRect()
    const width = menu.offsetWidth
    const placed = placePopover(
      DOMRect.fromRect({ x: rect.right - width, y: rect.top, width, height: rect.height }),
      { width, height: menu.offsetHeight },
      'bottom',
      ANCHOR_GAP,
    )
    setPosition({ left: placed.left, top: placed.top, width })
    const checked = menu.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    ;(checked ?? menu.querySelector<HTMLButtonElement>('[role="option"]'))?.focus({
      preventScroll: true,
    })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      setOpen(false)
    }
    const onDismiss = (): void => setOpen(false)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('scroll', onDismiss, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
    }
  }, [open])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
  }, [])

  const choose = useCallback(
    (next: T) => {
      close(true)
      if (next !== value) onChange(next)
    },
    [close, onChange, value],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close(true)
        return
      }
      if (event.key === 'Tab') {
        close(false)
        return
      }
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []),
      ]
      if (items.length === 0) return
      const step =
        event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step === 0 && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const active = items.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (Math.max(active, 0) + step + items.length) % items.length
      items[next]?.focus({ preventScroll: true })
    },
    [close],
  )

  return (
    <div className={styles.langSeat}>
      <button
        ref={triggerRef}
        type="button"
        className={cx(
          A.plain,
          A.inlineRow,
          styles.langTrigger,
          triggerClassName,
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{current?.label ?? value}</span>
        <LucideIcon
          name="chevron-down"
          size={12}
          className={cx(styles.langChevron, open && styles.langChevronOpen)}
        />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className={cx(A.col, styles.langMenu)}
              role="listbox"
              aria-label={ariaLabel}
              data-dsq-menu="true"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                minWidth: position?.width ?? 0,
                visibility: position === null ? 'hidden' : 'visible',
              }}
              onKeyDown={handleKeyDown}
            >
              {options.map((option) => {
                const selected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={cx(A.plain, A.row, styles.langOption, selected && styles.langOptionActive)}
                    onClick={() => choose(option.value)}
                  >
                    <span className={A.grow}>{option.label}</span>
                    <span className={styles.langCheck}>
                      {selected ? <LucideIcon name="check" size={14} /> : null}
                    </span>
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
