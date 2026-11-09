/**
 * Keep a press inside a floating surface from collapsing the selection the
 * surface acts on.
 *
 * A press on a button moves focus and clears the native selection unless the
 * default is cancelled on `pointerdown` — by the time `click` fires, the range
 * the surface latched is already gone. Text fields must keep their native
 * press: focus and caret placement are the default action there, and
 * cancelling it everywhere left the composer unable to regain focus once the
 * model chip had taken it. The selectable result regions (quote and
 * translation body) behave the same way — their press starts a native text
 * selection, which is the only way to copy part of a result.
 *
 * Shared by the floating toolbar and the Host's merged selection pill so the
 * two surfaces cannot drift apart on this rule.
 */

const NATIVE_PRESS = 'textarea, input, [contenteditable="true"], [data-dsq-selectable]'

/** `pointerdown` handler for any surface whose buttons act on a selection. */
export function guardSurfacePress(event: {
  target: EventTarget | null
  preventDefault(): void
  stopPropagation(): void
}): void {
  const target = event.target
  if (target instanceof Element && target.closest(NATIVE_PRESS) !== null) {
    event.stopPropagation()
    return
  }
  event.preventDefault()
  event.stopPropagation()
}
