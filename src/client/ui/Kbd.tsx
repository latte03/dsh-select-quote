/**
 * The Enter keycap painted on submit buttons.
 *
 * One glyph and one class for every editor: the React surfaces (comment box,
 * summary card) render `Kbd`, the DOM-rendered mark preview appends `createKbd`.
 * The submit predicate itself lives in `selection/popover-keys.ts`.
 */

import type { ReactNode } from 'react'
import { styles } from '../styles.ts'

export const KBD_GLYPH = '⏎'

export function Kbd(): ReactNode {
  return (
    <kbd className={styles.kbd} title="Enter" aria-hidden="true">
      {KBD_GLYPH}
    </kbd>
  )
}

/** Same keycap for plain-DOM surfaces that cannot render React. */
export function createKbd(): HTMLElement {
  const kbd = document.createElement('kbd')
  kbd.className = styles.kbd
  kbd.title = 'Enter'
  kbd.setAttribute('aria-hidden', 'true')
  kbd.textContent = KBD_GLYPH
  return kbd
}
