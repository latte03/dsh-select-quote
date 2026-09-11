import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libDir = resolve(root, 'lib')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

mkdirSync(libDir, { recursive: true })

// Minimal Node entry (no bundling needed).
writeFileSync(
  resolve(libDir, 'index.js'),
  `export const name = ${JSON.stringify(pkg.name)}\nexport function apply() {}\n`,
)

const buildDir = resolve(libDir, '.client-build')
const result = spawnSync(
  'tsdown',
  [
    resolve(root, 'src/client/index.tsx'),
    '--config',
    resolve(root, 'tsdown.config.ts'),
    '--out-dir',
    buildDir,
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const rawCandidates = ['index.js', 'index.cjs']
let rawPath = null
for (const name of rawCandidates) {
  const candidate = resolve(buildDir, name)
  try {
    readFileSync(candidate)
    rawPath = candidate
    break
  } catch {
    // try next
  }
}
if (!rawPath) {
  console.error('[dsh-select-quote] tsdown output not found in', buildDir)
  process.exit(1)
}

// Strip any pre-existing module preamble tsdown may have emitted.
const raw = readFileSync(rawPath, 'utf8')
  .replace(/^Object\.defineProperty\(exports, Symbol\.toStringTag, \{ value: "Module" \}\);\s*/m, '')
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${raw}
\t\treturn module.exports;
\t}
});
`

writeFileSync(resolve(libDir, 'client.js'), wrapped)
rmSync(buildDir, { recursive: true, force: true })
console.log(`[dsh-select-quote] wrote ${resolve(libDir, 'client.js')}`)
