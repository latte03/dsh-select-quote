import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Everything after `--` reaches the sync half, e.g. `pnpm dev:desktop -- --profile webdev`.
const extra = process.argv.slice(2)

const jobs = [
  { name: 'build', args: ['scripts/build.mjs', '--watch'] },
  { name: 'sync', args: ['scripts/sync-desktop.mjs', '--watch', ...extra] },
]

const children = jobs.map((job) =>
  spawn(process.execPath, [resolve(root, ...job.args)], { cwd: root, stdio: 'inherit' }),
)

for (const child of children) {
  child.on('exit', (code, signal) => {
    for (const other of children) if (other !== child && other.exitCode === null) other.kill('SIGTERM')
    process.exit(signal ? 0 : (code ?? 1))
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal)
  })
}

console.log('[dsh-select-quote] watching src/ and pushing every rebuild to the desktop profile (Ctrl-C to stop)')
