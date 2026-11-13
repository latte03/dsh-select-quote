import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Runs the mirror-split regression (scripts/mirror-harness) in headless Chrome.
 *
 * The decorator's invariants are DOM contracts with React's reconciler — text
 * node identity, record ordering, computed styles — which jsdom cannot observe,
 * so this drives a real browser over a real React root and fails on any red
 * assertion. Chrome is located via CHROME_BIN or the usual install paths.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harnessDir = resolve(root, 'scripts', 'mirror-harness')
const workDir = resolve(root, 'tmp', 'verify-mirror')

function fail(message) {
  console.error(`[dsh-select-quote] ${message}`)
  process.exit(1)
}

/** Resolve tsdown's JS entry so the child runs under the current Node binary. */
function tsdownEntry() {
  const pkgPath = resolve(root, 'node_modules', 'tsdown', 'package.json')
  if (!existsSync(pkgPath)) fail('tsdown is not installed. Run `pnpm install` first.')
  const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const bin = manifest.bin
  const relative = typeof bin === 'string' ? bin : bin?.tsdown
  const entry = relative === undefined ? undefined : resolve(root, 'node_modules', 'tsdown', relative)
  if (entry === undefined || !existsSync(entry)) fail('tsdown declares no usable bin entry.')
  return entry
}

function findChrome() {
  const override = process.env.CHROME_BIN
  if (override !== undefined && override !== '') return override
  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    win32: [
      resolve(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      resolve(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
  }[process.platform] ?? []
  return candidates.find((candidate) => existsSync(candidate))
}

/** dump-dom serialises text nodes, so entities come back escaped. */
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

mkdirSync(workDir, { recursive: true })

const tsdown = tsdownEntry()
// One invocation per entry: IIFE cannot code-split, and the reload bundle must
// be a separate module instance anyway (that is the point of the scenario).
for (const name of ['entry', 'reload']) {
  const bundled = spawnSync(
    process.execPath,
    [
      tsdown,
      resolve(harnessDir, `${name}.ts`),
      '--no-config',
      '--format', 'iife',
      '--platform', 'browser',
      '--out-dir', workDir,
      '--no-clean',
      '--no-report',
      '--logLevel', 'warn',
    ],
    { cwd: root, stdio: 'inherit', env: process.env },
  )
  if (bundled.error) fail(`failed to start tsdown: ${bundled.error.message}`)
  if (bundled.status !== 0) process.exit(bundled.status ?? 1)
  // tsdown suffixes IIFE output; the harness pages reference plain names.
  const produced = resolve(workDir, `${name}.iife.js`)
  if (!existsSync(produced)) fail(`tsdown produced no ${name}.iife.js in ${workDir}`)
  renameSync(produced, resolve(workDir, `${name}.js`))
}
copyFileSync(resolve(harnessDir, 'index.html'), resolve(workDir, 'index.html'))

const chrome = findChrome()
if (chrome === undefined) {
  fail('no Chrome/Chromium found. Install one or point CHROME_BIN at the binary.')
}

const profileDir = resolve(workDir, 'profile')
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    '--virtual-time-budget=20000',
    '--dump-dom',
    `file://${resolve(workDir, 'index.html')}`,
  ],
  { cwd: root, encoding: 'utf8', timeout: 120_000 },
)
rmSync(profileDir, { recursive: true, force: true })
if (run.error) fail(`failed to start Chrome (${chrome}): ${run.error.message}`)

const dom = run.stdout ?? ''
writeFileSync(resolve(workDir, 'dump.html'), dom)
const title = /<title>([\s\S]*?)<\/title>/.exec(dom)?.[1] ?? 'none'
const raw = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom)?.[1]
if (raw === undefined) {
  fail(`harness produced no report (title: ${title}). See ${resolve(workDir, 'dump.html')}`)
}

const report = JSON.parse(decodeEntities(raw))
if (report.failed > 0) {
  console.error(`[dsh-select-quote] mirror harness FAIL ${report.failed}/${report.total}`)
  for (const f of report.failures) console.error(`  ✗ ${f.name}${f.detail === '' ? '' : ` — ${f.detail}`}`)
  process.exit(1)
}
console.log(`ok: mirror harness ${report.total} assertions in real Chromium (streaming, inline growth, orphan cleanup, code form, module reload)`)