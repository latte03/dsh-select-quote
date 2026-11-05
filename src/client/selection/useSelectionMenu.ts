/**
 * Right-click / shortcut menu state. The menu latches its own selection so it
 * outlives later refresh passes; this hook owns that latch and its synchronous
 * ref mirror (DOM listeners dismiss it between renders).
 */

import { useCallback, useRef, useState } from 'react'
import type { SelectionSnapshot } from '../dom/selection.ts'

/** Latched selection + viewport anchor of the open right-click/shortcut menu. */
export interface MenuState {
  readonly snapshot: SelectionSnapshot
  readonly x: number
  readonly y: number
  /** Pointer opens keep the menu itself focused so no item looks selected. */
  readonly initialFocus: 'first' | 'menu'
}

export function useSelectionMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuRef = useRef<MenuState | null>(null)
  menuRef.current = menu

  /**
   * Drop the state **and** its ref in one tick. A refresh that runs right after
   * a dismissal must see the menu as closed; reading the stale ref made it keep
   * `active`, which raised the auto toolbar in contextmenu mode.
   */
  const dismiss = useCallback((): boolean => {
    if (!menuRef.current) return false
    menuRef.current = null
    setMenu(null)
    return true
  }, [])

  const open = useCallback(
    (
      snapshot: SelectionSnapshot,
      x: number,
      y: number,
      initialFocus: 'first' | 'menu',
    ): void => {
      setMenu({ snapshot, x, y, initialFocus })
    },
    [],
  )

  return { menu, menuRef, open, dismiss }
}
