import { createPluginRemote } from '../shared/plugin-remote.ts'

/**
 * Browser half of the plugin's Remote group (side task + translation).
 *
 * Mounted with `ctx.remote.$mount(...)`; the Host registered the matching
 * descriptor group from `src/typert.ts`.
 */
export default createPluginRemote()
