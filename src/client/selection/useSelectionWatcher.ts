/**
 * Transcript-wide pointer/selection observation for the toolbar.
 *
 * The controller owns the state; this hook owns *when* to re-read it. Keeping
 * the listener choreography here means the toolbar component does not have to
 * know about the drag/context-menu/scroll ordering rules.
 */

import { useEffect, type MutableRefObject } from 'react'
import { getConfig, resolveTriggers } from '../config.ts'
import { isInsideTranscript } from '../dom/message-text.ts'
import { pointInRects, shouldOpenSelectionMenu } from '../dom/menu-trigger.ts'
import { readSelectionSnapshot, type SelectionSnapshot } from '../dom/selection.ts'

export type SelectionPhase = 'idle' | 'comment' | 'side'

/** The menu's own chrome; a press inside it must not dismiss the selection. */
const MENU_SELECTOR = '[data-dsq-menu]'

export interface SelectionWatcherOptions {
  readonly toolbarRef: MutableRefObject<HTMLElement | null>
  readonly commentWrapRef: MutableRefObject<HTMLElement | null>
  readonly phaseRef: MutableRefObject<SelectionPhase>
  readonly touch: boolean
  readonly dismissMenu: () => boolean
  readonly refresh: () => void
  readonly flushComment: () => void
  readonly hide: () => void
  readonly openMenu: (
    snapshot: SelectionSnapshot,
    x: number,
    y: number,
    initialFocus: 'first' | 'menu',
  ) => void
}

export function useSelectionWatcher({
  toolbarRef,
  commentWrapRef,
  phaseRef,
  touch,
  dismissMenu,
  refresh,
  flushComment,
  hide,
  openMenu,
}: SelectionWatcherOptions): void {
  useEffect(() => {
    // Scroll / selectionchange / keyup can land several times in one tick;
    // collapse them into a single re-read — each refresh measures the range,
    // and during a scroll there is no point paying for that twice.
    let scheduled = false
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      window.setTimeout(() => {
        scheduled = false
        refresh()
      }, 0)
    }
    // The toolbar waits for the drag to end: selectionchange fires continuously
    // mid-drag, so it must not raise the toolbar — pointerup does.
    let dragging = false

    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const inToolbar = toolbarRef.current?.contains(target) === true
      const inComment = commentWrapRef.current?.contains(target) === true
      const inMenu =
        target instanceof Element && target.closest(MENU_SELECTOR) !== null
      if (inToolbar || inComment || inMenu) return
      // Any outside press may start a new selection drag.
      dragging = true

      // Outside click ends the optional comment step, never the annotation:
      // it was saved the moment "add annotation" was pressed. Keep what was typed
      // too — only an explicit skip / Escape discards the comment text.
      if (phaseRef.current === 'comment') {
        flushComment()
        hide()
        return
      }
      // The side composer holds no saved annotation: an outside press is a
      // plain dismissal of the question that has not been sent yet.
      if (phaseRef.current === 'side') {
        hide()
        return
      }

      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        schedule()
        return
      }
      hide()
    }

    const onPointerUp = () => {
      dragging = false
      schedule()
    }

    const onSelectionChange = () => {
      if (dragging) return
      schedule()
    }

    // Right-click is shared ground: the browser, the desktop shell and other
    // plugins may own it. Only take it when the gesture is unclaimed and aimed
    // at a live selection inside a message (see dom/menu-trigger.ts); otherwise
    // the native menu stays exactly as another plugin left it.
    const onContextMenu = (event: MouseEvent) => {
      // A new right-click first retargets or dismisses our own menu. A dismissal
      // that does not open a replacement must also re-sync `active`, or the auto
      // toolbar leaks in contextmenu mode.
      const hadMenu = dismissMenu()
      if (hadMenu) refresh()
      if (event.defaultPrevented) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (toolbarRef.current?.contains(target)) return
      if (target instanceof Element && target.closest(MENU_SELECTOR)) return
      // Touch has no right-click; an open comment step owns its own gestures.
      if (touch || phaseRef.current !== 'idle') return

      const contextMenuEnabled = resolveTriggers(getConfig()).contextMenu
      if (!contextMenuEnabled) return
      const selection = window.getSelection()
      const hasSelection =
        selection !== null && !selection.isCollapsed && selection.rangeCount > 0
      const pointInSelection =
        selection !== null &&
        hasSelection &&
        pointInRects(event.clientX, event.clientY, selection.getRangeAt(0).getClientRects())
      if (
        !shouldOpenSelectionMenu({
          defaultPrevented: event.defaultPrevented,
          contextMenuEnabled,
          touch,
          targetInTranscript: isInsideTranscript(target),
          pointInSelection,
          hasSelection,
        })
      ) {
        return
      }
      const snapshot = readSelectionSnapshot(toolbarRef.current)
      if (!snapshot) return
      event.preventDefault()
      event.stopPropagation()
      openMenu(snapshot, event.clientX, event.clientY, 'menu')
    }

    // Scroll inside our own popover must not count as a page scroll: a long
    // comment scrolls its textarea, and re-placing here would fight the user.
    // The capture listener fires for descendants too, so the origin has to be
    // checked instead of relying on bubbling.
    //
    // A page scroll follows the selection instead of dropping the toolbar: the
    // selection and its highlight survive scrolling, so hiding mid-annotation
    // read as "still selected, buttons gone". When the first line scrolls fully
    // out of view, readSelectionSnapshot returns null and refresh retracts the
    // idle toolbar (it reappears on the way back). An open comment popover is
    // never retracted by refresh, so scrolling away to re-read the question no
    // longer throws away what was typed.
    const onScroll = (event: Event) => {
      const target = event.target
      if (
        target instanceof Node &&
        (toolbarRef.current?.contains(target) === true ||
          commentWrapRef.current?.contains(target) === true)
      ) {
        return
      }
      schedule()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('keyup', schedule, true)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('contextmenu', onContextMenu)
    // A resize moves the selection's rect, so the toolbar must follow it rather
    // than vanish mid-annotation. Re-reading the live selection re-places it,
    // and drops it only when the selection itself is gone.
    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('keyup', schedule, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [
    commentWrapRef,
    dismissMenu,
    flushComment,
    hide,
    openMenu,
    phaseRef,
    refresh,
    toolbarRef,
    touch,
  ])
}
