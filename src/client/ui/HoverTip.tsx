/**
 * The hover label for an icon-only cell.
 *
 * Portaled to <body> for one concrete reason: the toolbar lives inside the
 * transcript scroller, which clips — a tip drawn by the button itself disappears
 * at the band's edge, which is exactly where the last row of icons sits.
 *
 * Motion follows the Lumno scale this plugin already uses elsewhere: 140ms (its
 * fastest step) on `cubic-bezier(0.2, 0.9, 0.2, 1)`, travelling 3px out of the
 * edge it hangs from, and **no opacity** — a fading surface samples its own
 * backdrop mid-transition, so the tip grows instead of appearing. Leaving is
 * instant: a hint that lingers after the pointer is gone is what feels slow.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { placeTip, type TipPlacement } from '../dom/tip-placement.ts'
import { styles } from '../styles.ts'

export interface TipTarget {
  readonly text: string
  readonly rect: { top: number; left: number; width: number; height: number }
}

/** Survives a pointer sweep across the row, still reads as immediate. */
const SHOW_DELAY = 120

export function HoverTip({ target }: { target: TipTarget | null }): ReactNode {
  const [shown, setShown] = useState(false)
  const [placement, setPlacement] = useState<TipPlacement | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (target === null) {
      setShown(false)
      setPlacement(null)
      return
    }
    const timer = window.setTimeout(() => setShown(true), SHOW_DELAY)
    return () => window.clearTimeout(timer)
  }, [target])

  // Measured after mount and before paint, so the first visible frame is already
  // in place; a layout effect makes the one-frame jump to (0,0) invisible.
  useLayoutEffect(() => {
    if (!shown || target === null) return
    const element = ref.current
    if (element === null) return
    const box = element.getBoundingClientRect()
    setPlacement(
      placeTip(target.rect, { width: box.width, height: box.height }, {
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      }),
    )
  }, [shown, target])

  if (!shown || target === null || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ref}
      className={styles.tip}
      data-side={placement?.side ?? 'top'}
      role="tooltip"
      style={placement === null ? undefined : { top: placement.top, left: placement.left }}
    >
      {target.text}
    </div>,
    document.body,
  )
}
