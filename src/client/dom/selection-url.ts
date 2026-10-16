/**
 * Link detection for the selection toolbar.
 *
 * A selection that is exactly one URL gets an "open in browser" action. Only
 * `http(s)` qualifies: the desktop shell hands those to `shell.openExternal`
 * (the real default browser), while every other scheme is refused by the app's
 * window-open handler — a button that silently does nothing is worse than no
 * button at all.
 */

/** Punctuation a drag-selection tends to swallow around a link. */
const EDGE_PUNCTUATION =
  /^[\s"'“”‘’()\[\]{}<>（ ）【】《》]+|[\s"'“”‘’()\[\]{}<>（ ）【】《》.,;:!?。，；：！？]+$/g

/** Schemes the app can actually hand to the system browser. */
const OPENABLE = new Set(['http:', 'https:'])

/** The selected text as a URL, or null when it is not one. */
export function selectionUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed.replace(EDGE_PUNCTUATION, ''))) return null
  const candidate = trimmed.replace(EDGE_PUNCTUATION, '')
  if (!/^https?:\/\//i.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (!OPENABLE.has(url.protocol)) return null
    return url.href
  } catch {
    return null
  }
}

/**
 * URL the toolbar's open action should use.
 *
 * The selected text wins when it is itself a URL; otherwise the anchor the
 * selection sits in decides — chat links are usually rendered as wording, so
 * selecting "点击这里" must still offer to open what it points at.
 */
export function linkTarget(text: string, anchorHref?: string | null): string | null {
  return selectionUrl(text) ?? (anchorHref ? selectionUrl(anchorHref) : null)
}
