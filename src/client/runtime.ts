/**
 * Shared runtime handles across slot scopes.
 *
 * The selection toolbar mounts at root (`shell.overlay`) while the annotation
 * panel is session-scoped, so both sides read one partition keyed by the
 * session the host minted for the active composer.
 */
export const runtime: {
  sessionId?: string
} = {}

export function setRuntimeSession(sessionId: string | undefined): void {
  if (sessionId) runtime.sessionId = sessionId
}
