/**
 * One body-level transient notice.
 *
 * The toolbar owns its own status line, but handoff feedback also happens from
 * plain DOM surfaces (an arrow-mark preview, a history card) where no React
 * tree is mounted. This is deliberately tiny: one node, auto-dismissed, no
 * queue — a second notice replaces the first.
 */

import { styles } from '../styles.ts'

let current: HTMLDivElement | null = null
let timer = 0

export function showToast(message: string, durationMs = 2400): void {
  if (typeof document === 'undefined' || !message) return
  if (timer !== 0) {
    window.clearTimeout(timer)
    timer = 0
  }
  current?.remove()
  const node = document.createElement('div')
  node.className = styles.toast
  node.setAttribute('role', 'status')
  node.textContent = message
  document.body.append(node)
  current = node
  timer = window.setTimeout(() => {
    timer = 0
    if (current === node) current = null
    node.remove()
  }, durationMs)
}
