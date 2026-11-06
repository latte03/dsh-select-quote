/**
 * Where the quote UI is allowed to appear.
 *
 * Two selectable surfaces exist today: conversation messages
 * (`[data-chat-flow-key]`) and the text of a file opened in the right
 * Sidebar's document preview (`[data-textpreview-content]`). Everything else —
 * the file tree, settings, the model picker — is app chrome.
 */

import { flowItemOf } from './message-text.ts'

export type SelectionSurface = 'transcript' | 'sidebarFile'

/** The document preview's content box; its header stays outside. */
export const SIDEBAR_FILE_CONTENT = '[data-textpreview-content]'
/** The file tree rendered beside a preview is navigation, not file text. */
const SIDEBAR_FILE_NAVIGATOR = '[data-files-navigator]'
/** Our toolbar and popovers live inside the preview's scroll container. */
const PLUGIN_LAYER = '[data-dsq-layer]'

function elementOf(node: Node | null): Element | null {
  return node instanceof Element ? node : (node?.parentElement ?? null)
}

/** True when `node` is selectable text inside a Sidebar document preview. */
export function isInsideSidebarFile(node: Node | null): boolean {
  const element = elementOf(node)
  if (!element) return false
  if (element.closest(PLUGIN_LAYER)) return false
  if (element.closest(SIDEBAR_FILE_NAVIGATOR)) return false
  return element.closest(SIDEBAR_FILE_CONTENT) !== null
}

/** The surface `node` belongs to, or null for app chrome. */
export function selectionSurfaceOf(node: Node | null): SelectionSurface | null {
  if (isInsideSidebarFile(node)) return 'sidebarFile'
  return flowItemOf(node) === null ? null : 'transcript'
}
