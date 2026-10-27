import { createSideTaskRemote } from '../shared/side-task-remote.ts'

/**
 * Browser half of the side-task Remote.
 *
 * Mounted with `ctx.remote.$mount(...)`; the Host registered the matching
 * descriptor group from `src/typert.ts`.
 */
export default createSideTaskRemote()
