import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const libDir = resolve(root, 'lib')
const log = (message) => console.log(`[${pkg.name}] ${message}`)
const fail = (message) => {
  console.error(`[${pkg.name}] ${message}`)
  process.exit(1)
}

const argv = process.argv.slice(2)
const flagValue = (name) => {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) fail(`--${name} needs a value`)
  return value
}
const profile = flagValue('profile') ?? process.env.DSH_PROFILE ?? 'desktop'
const watch = argv.includes('--watch')

for (const flag of argv) {
  if (flag.startsWith('--') && flag !== '--watch' && flag !== '--profile') {
    fail(`unknown flag ${flag} (supported: --profile <name>, --watch)`)
  }
}

function bundleFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile())
}

function bundleSignature() {
  return bundleFiles(libDir)
    .map((name) => {
      const stats = statSync(join(libDir, name))
      return `${name}:${stats.mtimeMs}:${stats.size}`
    })
    .join('|')
}

const installedDir = join(
  process.env.DSH_HOME || join(homedir(), '.dsh'),
  'profiles',
  profile,
  'node_modules',
  pkg.name,
)
const targetDir = join(installedDir, 'lib')

if (!existsSync(targetDir)) {
  fail(
    `no installed bundle at ${targetDir}\n` +
      `  Install the plugin into the "${profile}" profile first, then run this again.`,
  )
}

const sources = bundleFiles(libDir)
if (sources.length === 0) fail(`nothing to sync: ${libDir} is empty — run \`npm run build\` first`)

function sync() {
  const written = []
  for (const name of sources) {
    const source = join(libDir, name)
    const target = join(targetDir, name)
    // Comparing bytes rather than mtime: an unchanged bundle must not be rewritten,
    // because the host's hot reload fires on the file's stat signature, and rewriting
    // identical bytes would reload the plugin for no reason.
    if (existsSync(target) && readFileSync(target).equals(readFileSync(source))) continue
    writeFileSync(target, readFileSync(source))
    written.push(name)
  }
  return written
}

function reportDrift() {
  const installed = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8'))
  if (installed.version !== pkg.version) {
    log(`the profile still holds ${installed.version}; the running bundle is now the checkout (${pkg.version})`)
  }
}

const first = sync()
if (first.length === 0) {
  log(`profile "${profile}" bundle already matches ${libDir}`)
} else {
  log(`synced ${first.join(', ')} -> ${targetDir}`)
  reportDrift()
  log('the host stats every client bundle twice a second; the plugin reloads without a restart')
}

if (!watch) process.exit(0)

log(`watching ${libDir} for changes (Ctrl-C to stop)`)
let signature = bundleSignature()

// Polled instead of fs.watch: tsdown rewrites the bundle through a temp file, and
// the resulting event pairs differ per platform — a stat signature is portable.
const timer = setInterval(() => {
  const next = bundleSignature()
  if (next === signature) return
  signature = next
  const written = sync()
  if (written.length > 0) log(`pushed ${written.join(', ')} — the plugin reloads`)
}, 300)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(timer)
    process.exit(0)
  })
}
