/**
 * Leaf DOM builders shared by the two chip-preview modes.
 *
 * Keeping the icon-button skin and the two-step remove confirm here means the
 * normal annotation preview and the handoff preview cannot drift apart.
 */

import { A, cx, styles } from '../styles.ts'
import { iconMarkup, type IconName } from '../ui/icons.tsx'

export function appendLabel(parent: HTMLElement, text: string): void {
  const label = document.createElement('div')
  label.className = styles.chipPreviewLabel
  label.textContent = text
  parent.append(label)
}

export function appendText(parent: HTMLElement, className: string, text: string): void {
  const node = document.createElement('div')
  node.className = className
  node.textContent = text
  parent.append(node)
}

/** Icon-only action button at the preview's shared 14px icon size. */
export function iconActionButton(
  name: IconName,
  label: string,
  onClick?: (event: MouseEvent) => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = cx(A.plain, A.gridMid, styles.chipPreviewAction)
  button.setAttribute('aria-label', label)
  button.title = label
  button.insertAdjacentHTML('afterbegin', iconMarkup(name, 14))
  if (onClick) button.addEventListener('click', onClick)
  return button}

/**
 * Destructive action with an in-place second step: the first press grows the
 * icon into "icon + confirm label", the second runs `onConfirm`. No re-render,
 * so the width/opacity transition actually runs.
 */
export function twoStepRemoveButton(input: {
  readonly label: string
  readonly confirmLabel: string
  readonly onConfirm: () => void
}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = cx(A.plain, A.gridMid, styles.chipPreviewAction)
  button.setAttribute('aria-label', input.label)
  button.title = input.label
  const inner = document.createElement('span')
  inner.className = styles.deleteConfirmInner
  inner.insertAdjacentHTML('afterbegin', iconMarkup('trash-2', 14))
  const label = document.createElement('span')
  label.className = styles.deleteConfirmLabel
  label.textContent = input.confirmLabel
  inner.append(label)
  button.append(inner)
  button.addEventListener('click', () => {
    if (button.dataset.confirming !== 'true') {
      button.dataset.confirming = 'true'
      button.className = cx(A.plain, A.inlineRow, styles.deleteConfirm)
      button.setAttribute('aria-label', input.confirmLabel)
      button.title = input.confirmLabel
      return
    }
    input.onConfirm()
  })
  return button
}
