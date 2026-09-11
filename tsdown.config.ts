/** @type {import('tsdown').UserConfig} */
export default {
  entry: ['src/client/index.tsx'],
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: true,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
  ],
}
