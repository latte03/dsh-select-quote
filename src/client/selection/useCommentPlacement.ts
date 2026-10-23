/**
 * Measures the comment popover and its hint toolbar, then writes the geometry
 * from `dom/comment-placement.ts` back as content coordinates. The React
 * component keeps the refs; this hook owns the measure/place lifecycle.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  type MutableRefObject,
} from 'react'
import { placeCommentSurfaces } from '../dom/comment-placement.ts'
import type { SelectionSnapshot } from '../dom/selection.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

interface CommentPlacementOptions {
  readonly touch: boolean
  readonly phase: SelectionPhase
  readonly active: SelectionSnapshot | null
  readonly toolbarRef: MutableRefObject<HTMLDivElement | null>
  readonly commentWrapRef: MutableRefObject<HTMLDivElement | null>
}

export function useCommentPlacement({
  touch,
  phase,
  active,
  toolbarRef,
  commentWrapRef,
}: CommentPlacementOptions): () => void {
  const place = useCallback(() => {
    if (touch) return
    const layer = active?.layer
    const toolbar = toolbarRef.current
    const pop = commentWrapRef.current
    if (!active || !layer || !toolbar || !pop) return

    pop.style.display = 'flex'
    pop.style.visibility = 'hidden'
    const panel = { width: pop.offsetWidth || 320, height: pop.offsetHeight || 180 }
    pop.style.visibility = ''

    const at = placeCommentSurfaces({
      layer,
      selection: active,
      toolbar: { width: toolbar.offsetWidth, height: toolbar.offsetHeight },
      panel,
    })
    pop.style.top = `${at.popover.top}px`
    pop.style.left = `${at.popover.left}px`
    toolbar.style.left = `${at.toolbar.left}px`
    toolbar.style.top = `${at.toolbar.top}px`
  }, [active, commentWrapRef, toolbarRef, touch])

  // Use layout effects: the box is measured and placed before the first paint,
  // so it never flashes at the host's origin. Scroll itself does not need a
  // re-place — content coordinates already follow the selection.
  useLayoutEffect(() => {
    if (phase === 'comment') place()
  }, [phase, place])

  // The popover is anchored to the toolbar, so a window resize moves both.
  useEffect(() => {
    if (touch) return
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [place, touch])

  return place
}
