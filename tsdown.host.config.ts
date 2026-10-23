/**
 * Host half build. `lib/index.js` is the Node entry the Loader resolves by
 * package name, so it must carry the real `Config` schema — the old hand-written
 * stub did not. Schemastery is a devDependency and gets bundled in, keeping the
 * published package independent of how the profile resolves host packages.
 *
 * @type {import('tsdown').UserConfig}
 */
export default {
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: true,
}
