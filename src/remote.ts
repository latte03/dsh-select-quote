import { createPluginRemote } from './shared/plugin-remote.ts'

/**
 * Host-for-Client face of the plugin's Remote group (`exports["./remote"]`).
 *
 * A Client assembly can import this default contribution and mount it with
 * `ctx.remote.$mount()`; the browser half of this package mounts the same
 * object directly.
 */
export { createPluginRemote }
export default createPluginRemote()
