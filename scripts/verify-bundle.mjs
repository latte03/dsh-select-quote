/**
 * Headless bundle check.
 *
 * `tsdown` does not typecheck, so a bundle can build "successfully" while being
 * broken at runtime (for example a stray backtick inside the CSS template
 * literal terminates the string and produces invalid JS). This script runs the
 * built `lib/client.js` the way the browser does — a fake
 * `window.__ModuleLoader__` plus a `require` shim — then calls `apply()` with a
 * mock Cordis context and asserts every registration landed.
 *
 * Usage: npm run verify   (after npm run build)
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))

/** Everything this plugin is expected to contribute when it is mounted. */
const EXPECTED = [
  { kind: 'slots.register', label: 'shell.overlay / select-quote-toolbar' },
  { kind: 'slots.register', label: 'conversation.input.overlay / select-quote-card' },
  { kind: 'slots.register', label: 'conversation.input.overlay / select-quote-session-bridge' },
  { kind: 'slots.register', label: 'conversation.chat.node / user' },
  { kind: 'locale.language', label: 'ru' },
  { kind: 'locale.register', label: 'select-quote (en, zh)' },
  { kind: 'locale.register', label: 'select-quote (ru)' },
  { kind: 'locale.bind', label: 'select-quote' },
]

/** Languages the host ships; a namespace must carry both in one typed call. */
const SHIPPED_LOCALES = ['en', 'zh']

const SEEDS = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'])

function loadFactory(code) {
  let definition
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value
        },
      },
    },
    console,
    setTimeout,
    clearTimeout,
    Symbol,
    Object,
    Array,
    Math,
    Date,
    JSON,
    Map,
    Set,
    Promise,
    Error,
    RegExp,
    String,
    Number,
    Boolean,
    isNaN,
    parseInt,
    parseFloat,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: 'lib/client.js' })
  if (definition === undefined) throw new Error('the bundle never called window.__ModuleLoader__.load()')
  return definition
}

function mockContext(record) {
  /** Registered copy: namespace -> locale -> key -> template. */
  const dicts = new Map()
  const snapshot = { active: 'en', locales: [{ id: 'en', label: 'English' }], revision: 0 }
  const ctx = {
    effect(callback, label) {
      record.push({ kind: 'effect', label: String(label) })
      return typeof callback() === 'function' ? () => {} : () => {}
    },
    get() {
      return undefined
    },
  }
  ctx.slots = {
    inject(key, callback) {
      record.push({ kind: 'slots.inject', label: key })
      return callback()
    },
    register(options, component) {
      const cell = options.key ?? options.id
      record.push({ kind: 'slots.register', label: `${options.name} / ${cell}`, component })
      return () => {}
    },
  }
  ctx.sessions = { scope: () => undefined }
  ctx.locale = {
    getLocale: () => snapshot,
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    // Only the user, through Settings, owns this write.
    setLocale(id) {
      throw new Error(`a plugin must not write the language preference: setLocale("${id}")`)
    },
    addLanguage(definition) {
      for (const field of ['id', 'label', 'fallback']) {
        if (typeof definition[field] !== 'string' || !definition[field]) {
          throw new Error(`addLanguage: malformed or missing "${field}"`)
        }
      }
      record.push({ kind: 'locale.language', label: definition.id })
      return () => {}
    },
    register(ns, localeOrDicts, dict) {
      const pairs =
        typeof localeOrDicts === 'string' ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts)
      const perLocale = dicts.get(ns) ?? new Map()
      dicts.set(ns, perLocale)
      for (const [locale] of pairs) {
        if (perLocale.has(locale)) {
          throw new Error(`locale namespace "${ns}" already has locale "${locale}"`)
        }
      }
      for (const [locale, table] of pairs) perLocale.set(locale, table)
      record.push({
        kind: 'locale.register',
        label: `${ns} (${pairs.map(([locale]) => locale).sort().join(', ')})`,
      })
      return () => {}
    },
    bind(ns) {
      record.push({ kind: 'locale.bind', label: ns })
      return (key, params) => {
        const table = dicts.get(ns)?.get(snapshot.active) ?? dicts.get(ns)?.get('en')
        const template = table?.[key] ?? key
        if (!params) return template
        return template.replace(/\{(\w+)\}/g, (whole, name) =>
          name in params ? String(params[name]) : whole,
        )
      }
    },
    resolveText: (text) => (typeof text === 'string' ? text : ''),
  }
  return { ctx, dicts }
}

/**
 * Copy must be complete in every registered language.
 *
 * Two rules, both aimed at silent failures: a key that exists in one language
 * and not another renders the raw key; a template whose `{placeholder}` name
 * drifted renders the placeholder text inside translated copy. Plural messages
 * are compared as a group (`key.one` / `key.few` / …), because languages
 * legitimately carry different plural forms — what every language must carry is
 * the `key.other` fallback that `t()` degrades to.
 */
const PLURAL_FORMS = new Set(['one', 'few', 'many', 'other'])
const PLURAL_SUFFIX = /\.(one|few|many|other)$/

/** group name -> Map(form or '' -> placeholder token list). */
function groupsOf(table) {
  const groups = new Map()
  for (const [key, value] of Object.entries(table)) {
    const match = key.match(PLURAL_SUFFIX)
    const group = match ? key.slice(0, match.index) : key
    const form = match ? match[1] : ''
    const tokens = [...String(value).matchAll(/\{(\w+)\}/g)].map((found) => found[1]).sort().join(',')
    const entry = groups.get(group) ?? new Map()
    entry.set(form, tokens)
    groups.set(group, entry)
  }
  return groups
}

function checkDictionaries(dicts) {
  const problems = []
  for (const [ns, perLocale] of dicts) {
    const locales = [...perLocale.keys()].sort()
    for (const shipped of SHIPPED_LOCALES) {
      if (!perLocale.has(shipped)) {
        problems.push(`${ns}: host-shipped locale "${shipped}" is not registered`)
      }
    }
    const reference = perLocale.get('en') ?? perLocale.get(locales[0])
    const refGroups = groupsOf(reference)
    // Every group resolves to one placeholder list; drift is reported per key.
    const refTokens = new Map()
    for (const [group, forms] of refGroups) {
      const values = [...forms.values()]
      refTokens.set(group, values[0] ?? '')
      for (const [form, tokens] of forms) {
        if (tokens !== (values[0] ?? '')) {
          problems.push(`${ns}.${group}${form ? `.${form}` : ''}: placeholders "${tokens}" drift from "${values[0]}" in en`)
        }
      }
    }
    for (const locale of locales) {
      const table = perLocale.get(locale)
      const groups = groupsOf(table)
      for (const group of refGroups.keys()) {
        if (!groups.has(group)) problems.push(`${ns}.${group}: missing in "${locale}"`)
      }
      for (const group of groups.keys()) {
        if (!refGroups.has(group)) problems.push(`${ns}.${group}: only in "${locale}"`)
      }
      for (const [group, forms] of groups) {
        const expected = refTokens.get(group) ?? ''
        for (const [form, tokens] of forms) {
          if (tokens !== expected) {
            problems.push(
              `${ns}.${group}${form ? `.${form}` : ''}: placeholders "${tokens}" in "${locale}" vs "${expected}" in en`,
            )
          }
        }
        const plural = [...forms.keys()].some((form) => form && PLURAL_FORMS.has(form))
        if (plural && !forms.has('other')) {
          problems.push(`${ns}.${group}: plural group has no "other" form in "${locale}"`)
        }
      }
      for (const [key, value] of Object.entries(table)) {
        if (typeof value !== 'string' || !value.trim()) {
          problems.push(`${ns}.${key}: empty copy in "${locale}"`)
        }
      }
    }
  }
  return problems
}

const code = readFileSync(resolve(root, 'lib/client.js'), 'utf8')
const bundle = loadFactory(code)
console.log(`bundle id: ${bundle.id}`)

const module = bundle.factory((name) => {
  if (!SEEDS.has(name)) throw new Error(`require("${name}") is not a platform seed word`)
  return require(name)
})

const record = []
const { ctx, dicts } = mockContext(record)
const outcome = module.apply(ctx)
if (outcome !== undefined) throw new Error('apply() must not return a value')

const missing = EXPECTED.filter(
  (expected) => !record.some((entry) => entry.kind === expected.kind && entry.label === expected.label),
)
const broken = record.filter((entry) => entry.kind === 'slots.register' && typeof entry.component !== 'function')
const dictionaryProblems = checkDictionaries(dicts)

for (const entry of record) console.log(`  ${entry.kind.padEnd(16)} ${entry.label}`)

if (missing.length > 0 || broken.length > 0 || dictionaryProblems.length > 0) {
  for (const entry of missing) console.error(`MISSING: ${entry.kind} ${entry.label}`)
  for (const entry of broken) console.error(`NOT A COMPONENT: ${entry.label}`)
  for (const problem of dictionaryProblems) console.error(`DICTIONARY: ${problem}`)
  process.exit(1)
}
const languages = new Set()
for (const perLocale of dicts.values()) for (const locale of perLocale.keys()) languages.add(locale)
console.log(
  `ok: ${EXPECTED.length} contributions registered, ${module.inject.join(', ')} injected, ` +
    `copy complete for ${[...languages].sort().join('/')}`,
)
