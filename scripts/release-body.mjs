#!/usr/bin/env node
/**
 * Compose the GitHub Release body for one tagged version.
 *
 * Three pieces, in this order:
 *
 *   1. an optional narrative — `docs/releases/<version>.md`, written by hand
 *      when a release needs more than a commit list (the 0.4.2 shape);
 *   2. the CHANGELOG section for that version, taken verbatim so the release
 *      and the file can never disagree;
 *   3. the standing install / compare / badge footer.
 *
 * The compare link is read out of the CHANGELOG heading rather than from git, so
 * the script needs no history and behaves the same on a shallow checkout.
 *
 * Usage: node scripts/release-body.mjs <version|tag>
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const version = (process.argv[2] ?? '').replace(/^v/, '')

if (version === '') {
  console.error('usage: node scripts/release-body.mjs <version|tag>')
  process.exit(2)
}

const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split('\n')
const escaped = version.replace(/\./g, '\\.')
const heading = new RegExp(`^##\\s+\\[?${escaped}\\]?(?:\\s|$|\\(|\\[)`)
const start = lines.findIndex((line) => heading.test(line))

if (start === -1) {
  console.error(`release-body: CHANGELOG.md has no section for ${version}`)
  process.exit(1)
}

let end = lines.length
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].startsWith('## ')) {
    end = i
    break
  }
}

const section = lines.slice(start + 1, end).join('\n').trim()
if (section === '') {
  console.error(`release-body: section for ${version} is empty`)
  process.exit(1)
}

const compare = /\((https?:\/\/[^)]+\/compare\/[^)]+)\)/.exec(lines[start])?.[1]

const narrativePath = join(root, 'docs', 'releases', `${version}.md`)
const narrative = existsSync(narrativePath)
  ? readFileSync(narrativePath, 'utf8').trim()
  : ''

const footer = [
  '## 安装 / 更新',
  '',
  '网页版：',
  '',
  '```bash',
  'dsh plugin --profile web add dsh-select-quote',
  '```',
  '',
  '桌面版：应用内输入 `dsh-select-quote` 安装，或到插件页搜索安装，重启客户端生效。',
  ...(compare === undefined ? [] : ['', `完整对比：${compare}`]),
  '',
  '[![powered by dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)',
].join('\n')

const parts = []
if (narrative !== '') parts.push(narrative)
parts.push(['## 本次变化', '', section].join('\n'))
parts.push(footer)

process.stdout.write(`${parts.join('\n\n')}\n`)
