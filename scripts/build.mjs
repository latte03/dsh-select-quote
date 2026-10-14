import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

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

// Resolve tsdown's JS entry and run it with the current Node binary.
//
// Spawning the bare command `tsdown` only works on POSIX: there the bin is a
// symlink to a `#!/usr/bin/env node` script. On Windows the bin is a `.cmd`
// shim, and Node refuses to spawn `.cmd` without `shell: true` (a deliberate
// security measure since CVE-2024-27980) — the call fails with EINVAL and,
// because stdio was inherited, exits 1 without printing anything. Going through
// `process.execPath` + the package entry works identically on every platform
// and keeps the child's stdio piped straight through.
function resolveTsdownEntry() {
  // `exports` does not necessarily expose the bin, so read it from the manifest.
  const pkgPath = resolve(root, 'node_modules', 'tsdown', 'package.json')
  if (!existsSync(pkgPath)) {
    console.error(
      '[dsh-select-quote] tsdown is not installed. Run `npm install` first.',
    )
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const bin = manifest.bin
  const relative = typeof bin === 'string' ? bin : bin?.tsdown
  if (!relative) {
    console.error('[dsh-select-quote] tsdown declares no "tsdown" bin entry.')
    process.exit(1)
  }
  const entry = resolve(root, 'node_modules', 'tsdown', relative)
  if (!existsSync(entry)) {
    console.error('[dsh-select-quote] tsdown bin entry not found at', entry)
    process.exit(1)
  }
  return entry
}

const tsdownArgs = [
  resolveTsdownEntry(),
  resolve(root, 'src/client/index.tsx'),
  '--config',
  resolve(root, 'tsdown.config.ts'),
  '--out-dir',
  buildDir,
]

function findRawOutput() {
  // `exports` of tsdown's config emit either a .js or .cjs depending on format
  // resolution, so probe both instead of assuming one.
  for (const name of ['index.js', 'index.cjs']) {
    const candidate = resolve(buildDir, name)
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      // try next
    }
  }
  return null
}

function writeClientBundle(rawPath) {
  const target = resolve(libDir, 'client.js')
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
  writeFileSync(target, wrapped)
  return target
}

if (process.argv.includes('--watch')) {
  rmSync(buildDir, { recursive: true, force: true })
  const child = spawn(process.execPath, [...tsdownArgs, '--watch'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => {
    rmSync(buildDir, { recursive: true, force: true })
    process.exit(code ?? 0)
  })

  let signature = ''
  // tsdown only writes the unwrapped bundle; every rebuild needs the wrapper
  // re-applied, and `clean: true` deletes the out dir in between, so poll for
  // the raw output reappearing rather than trusting a single change event.
  const timer = setInterval(() => {
    const rawPath = findRawOutput()
    if (!rawPath) return
    const stats = statSync(rawPath)
    const next = `${stats.mtimeMs}:${stats.size}`
    if (next === signature) return
    signature = next
    console.log(`[dsh-select-quote] wrote ${writeClientBundle(rawPath)}`)
  }, 200)

  const stop = () => {
    clearInterval(timer)
    child.kill('SIGTERM')
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  console.log(`[dsh-select-quote] watching ${resolve(root, 'src')} (Ctrl-C to stop)`)
} else {
  const result = spawnSync(process.execPath, tsdownArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    console.error('[dsh-select-quote] failed to start tsdown:', result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  const rawPath = findRawOutput()
  if (!rawPath) {
    console.error('[dsh-select-quote] tsdown output not found in', buildDir)
    process.exit(1)
  }

  const target = writeClientBundle(rawPath)
  rmSync(buildDir, { recursive: true, force: true })
  console.log(`[dsh-select-quote] wrote ${target}`)
}
