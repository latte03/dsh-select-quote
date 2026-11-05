/**
 * Shared identity of the target picker surface.
 *
 * The picker is a body portal; page-level listeners (selection refresh, menu
 * dismissal) need to recognize scrolls and presses inside it so they do not
 * tear the surface down. The marker attribute lives here so the component and
 * those listeners cannot drift apart.
 */

export const TARGET_PICKER_ATTRIBUTE = 'data-dsq-target-picker'

const TARGET_PICKER_SELECTOR = `[${TARGET_PICKER_ATTRIBUTE}="true"]`

export const TARGET_PICKER_ATTRIBUTES: Readonly<Record<string, string>> = Object.freeze({
  [TARGET_PICKER_ATTRIBUTE]: 'true',
})

export function isInsideTargetPicker(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest(TARGET_PICKER_SELECTOR) !== null
}
