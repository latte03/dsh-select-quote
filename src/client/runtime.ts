/**
 * Shared runtime handles across slot scopes.
 *
 * The selection toolbar mounts at root (`shell.overlay`) while the annotation
 * panel is session-scoped, so both sides read one partition keyed by the
 * session the host minted for the active composer.
 *
 * The Host shortcut commands live in `apply()`, outside React, and need a way
 * back into the mounted toolbar; that bridge is published here as well.
 */
export type SelectionBridgeState = 'ready' | 'no-selection' | 'busy'

export interface SelectionBridge {
  /** Whether a keyboard command can act right now, and why not. */
  state(): SelectionBridgeState
  /** Open the menu beside the selection, if it is still there. */
  open(): void
  /** Save the selection as an annotation and open its comment step. */
  add(): void
}

export const runtime: {
  sessionId?: string
  selection?: SelectionBridge
} = {}

export function setRuntimeSession(sessionId: string | undefined): void {
  if (sessionId) runtime.sessionId = sessionId
}
