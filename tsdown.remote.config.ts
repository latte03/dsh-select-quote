/**
 * Host-for-Client Typert contribution build. `exports["./remote"]` is the
 * mountable contribution a Client assembly imports, so it must be a standalone
 * ES module next to `lib/index.js`.
 *
 * Zod and the Remote-descriptor helper are bundled in: the profile's strict
 * node_modules layout would not make either reachable from here.
 *
 * @type {import('tsdown').UserConfig}
 */
export default {
  entry: ['src/remote.ts'],
  format: ['esm'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: [/^zod$/],
    onlyBundle: [/^zod$/],
  },
}
