/**
 * Pick the host's own `user` Chat node view out of the live slot registry.
 *
 * The plugin registers the same cell at `priority: -10` to win the election,
 * so the registry also contains this plugin's own wrapper. Exclude it by
 * component identity: a priority value is a registration detail that happens
 * to be unique today, not an identity.
 */

import type { SlotEntryInspection } from '../context.d.ts'

const HOST_USER_NAME = 'UserMessageNodeView'

/** Component name across memo/forwardRef/plain function shapes. */
export function componentName(component: unknown): string | undefined {
  const candidate = component as
    | {
        type?: { name?: string }
        render?: { name?: string }
        name?: string
        displayName?: string
      }
    | undefined
  return (
    candidate?.type?.name ??
    candidate?.render?.name ??
    candidate?.name ??
    candidate?.displayName
  )
}

/**
 * The host user view, or undefined when it cannot be identified safely.
 *
 * A renamed host leaves one non-self `user` entry, which is still almost
 * certainly the host; more than one is ambiguous, so callers should show the
 * hostless fallback instead of delegating to an arbitrary plugin's wrapper.
 */
export function pickHostUser(
  entries: readonly SlotEntryInspection[],
  self: unknown,
): unknown | undefined {
  const candidates = entries.filter(
    (entry) =>
      entry.options?.key === 'user' &&
      entry.component !== undefined &&
      entry.component !== self,
  )
  const named = candidates.find((entry) => componentName(entry.component) === HOST_USER_NAME)
  return (named ?? (candidates.length === 1 ? candidates[0] : undefined))?.component
}
