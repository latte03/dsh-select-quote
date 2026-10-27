import { PACKAGE_NAME } from './shared/identity.ts'
import { createSideTaskRemote } from './shared/side-task-remote.ts'

const $remote = createSideTaskRemote()


/**
 * Host-face Typert contribution.
 *
 * `typert-loader` finds this through the package's `exports["./typert"]` and
 * registers it without activating anything else; the browser half mounts the
 * matching descriptor group from `src/client/remote.ts`.
 */
export const TYPERT = {
  package: PACKAGE_NAME,
  face: 'host' as const,
  schemas: [] as const,
  get invocations() {
    return $remote.descriptors
  },
  model: { services: [], events: [], objects: [] },
}
