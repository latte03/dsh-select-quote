/**
 * Pick the host's own Chat node view out of the live slot registry.
 *
 * The plugin registers the same cells at `priority: -10` to win the election,
 * so the registry also contains this plugin's own wrappers. Exclude them by
 * component identity: a priority value is a registration detail that happens
 * to be unique today, not an identity.
 *
 * The host registers its `UserMessageNodeView` under both `user` and
 * `steering`, so the lookup is per key instead of assuming `user`.
 */

import type { SlotEntryInspection } from '../context.d.ts'

const HOST_NODE_NAME = 'UserMessageNodeView'

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
 * The host view registered for `key`, or undefined when it cannot be
 * identified safely.
 *
 * A renamed host leaves one non-self entry for that key, which is still
 * almost certainly the host; more than one is ambiguous, so callers should
 * show the hostless fallback instead of delegating to an arbitrary plugin's
 * wrapper.
 */
export function pickHostNode(
  entries: readonly SlotEntryInspection[],
  self: unknown,
  key: string,
): unknown | undefined {
  const candidates = entries.filter(
    (entry) =>
      entry.options?.key === key &&
      entry.component !== undefined &&
      entry.component !== self,
  )
  const named = candidates.find((entry) => componentName(entry.component) === HOST_NODE_NAME)
  return (named ?? (candidates.length === 1 ? candidates[0] : undefined))?.component
}
