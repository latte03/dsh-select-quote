/**
 * Enter gestures for the plugin's own popovers (comment box, side-task
 * composer). They mirror the visible accent button, which mirrors the host
 * composer: the submit predicate is the host's own `isSubmitKey`, so plain
 * Enter, Ctrl+Enter and Cmd+Enter all commit, and only Shift+Enter inserts a
 * line break. Alt, the two modifiers together, AltGraph and IME composition
 * are ignored, exactly as in the composer.
 */

import { isSubmitKey } from '../dom/composer-host.ts'

export type PopoverEnter = 'submit' | 'newline' | 'ignore'

export function popoverEnter(event: Parameters<typeof isSubmitKey>[0]): PopoverEnter {
  if (event.key !== 'Enter') return 'ignore'
  if (event.isComposing) return 'ignore'
  if (event.shiftKey) return 'newline'
  return isSubmitKey(event) ? 'submit' : 'ignore'
}