/**
 * Host-face Typert manifest build. `typert-loader` resolves this through the
 * package's `exports["./typert"]`, so it must be a standalone ESM module.
 *
 * Zod and the Remote-descriptor helper are bundled in: the Loader resolves
 * this file from the package, and the profile's strict node_modules layout
 * would not make either of them reachable from here.
 *
 * @type {import('tsdown').UserConfig}
 */
export default {
  entry: ['src/typert.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: [/^zod$/],
    onlyBundle: [/^zod$/],
  },
}
