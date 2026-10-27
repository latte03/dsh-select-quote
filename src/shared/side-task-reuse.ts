import { createHash } from 'node:crypto'

/**
 * Reuse bookkeeping for the "one side child per main session" mode.
 *
 * The identity is derived, never remembered: a Host restart or a new browser
 * tab resolves the same child again. The shape is UUID-like so the value is
 * indistinguishable from an ordinary session id in logs and the catalog.
 */
export function reusableChildId(parentSessionId: string): string {
  const hex = createHash('sha256')
    .update(`dsh-select-quote:side-task:${parentSessionId}`)
    .digest('hex')
    .slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/**
 * Whether a failed continuation means "no such child" rather than a refusal.
 * The gateway wraps refusals in `RemoteError` and keeps the original
 * `SubagentError` as `cause`, so the code can sit on either level.
 */
export function isNotResumable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  if (code === 'subagent/not-resumable' || code === 'NOT_RESUMABLE') return true
  return isNotResumable((error as { cause?: unknown }).cause)
}
