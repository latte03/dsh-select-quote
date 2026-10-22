import { useEffect, useState } from 'react'

/**
 * The same query the coarse-pointer CSS uses. Keeping JS and CSS on one
 * criterion means a device never gets the bottom bar with desktop positioning
 * (or the reverse).
 */
const COARSE_POINTER = '(hover: none), (pointer: coarse)'

function coarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(COARSE_POINTER).matches
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(coarsePointer)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(COARSE_POINTER)
    const onChange = (event: MediaQueryListEvent): void => setCoarse(event.matches)
    setCoarse(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return coarse
}

export interface VisualViewportMetrics {
  /** Layout-viewport pixels hidden below the visual viewport (the soft keyboard). */
  inset: number
  height: number
}

function measure(): VisualViewportMetrics {
  if (typeof window === 'undefined') return { inset: 0, height: 0 }
  const viewport = window.visualViewport
  const layout = document.documentElement.clientHeight || window.innerHeight
  if (!viewport) return { inset: 0, height: window.innerHeight }
  return {
    inset: Math.max(0, Math.round(layout - viewport.height - viewport.offsetTop)),
    height: Math.round(viewport.height),
  }
}

/**
 * Ride above the soft keyboard. `innerHeight` alone is not enough: iOS keeps the
 * layout viewport at full height and only shrinks the visual viewport, while
 * Android resizes the layout viewport. The inset is zero in the Android case
 * because the fixed element then already sits above the keyboard.
 */
export function useVisualViewport(enabled: boolean): VisualViewportMetrics {
  const [metrics, setMetrics] = useState(measure)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const update = (): void => setMetrics(measure())
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [enabled])
  return metrics
}
