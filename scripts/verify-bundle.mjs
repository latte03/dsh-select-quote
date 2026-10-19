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
 * It then replays the annotation persistence cycle against the real source
 * modules (save → drop the in-memory store → reload → reconcile → clear →
 * retention), with no DOM involved.
 *
 * Finally it checks the package's display metadata — the `locale/*.json`
 * dictionaries and `icon.svg` the plugin manager reads through `exports`
 * without activating the plugin — the way the host's own reader checks them,
 * and confirms the packed tarball actually contains them.
 *
 * Usage: npm run verify   (after npm run build)
 */

import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, extname, relative, resolve } from 'node:path'
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

const SEEDS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
])

/**
 * Replay the annotation persistence cycle headlessly (Q9).
 *
 * The store layer is DOM-free and takes its storage as a port, so the real
 * source modules can be imported straight into Node. A query-busted import
 * gives a second, independent store instance — that is the "reload": fresh
 * in-memory map, same storage underneath. (`runtime.ts` is a shared
 * dependency, so it survives the reload exactly as it does in the browser;
 * the reload phase therefore drives `adoptPersistedAnnotations` directly,
 * which is what the deferred bind call ends up invoking.)
 *
 * One backend: the plugin's own localStorage keys. (The host's
 * `@deepseek-ai/dsh-client-store` used to be the primary backend, but its
 * persistence layer *is* localStorage with the same key and payload, and the
 * plugin spec forbids loading Harness Client packages as modules — so the
 * direct backend is the whole story now.)
 */
let moduleRevision = 0

async function freshStore() {
  moduleRevision += 1
  const url = new URL(
    `../src/client/state/annotation-store.ts?revision=${moduleRevision}`,
    import.meta.url,
  )
  return import(url.href)
}

const flush = () => new Promise((done) => setTimeout(done, 0))

/** One backend: save → reload → reconcile → clear → retention. */
async function replay(portFactory, storage, problems, label) {
  const key = (sessionId) => `dsh.select-quote.annotations.${sessionId}`
  const source = { text: '第一段被划中的原文', messageId: 'flow-1', startOffset: 4, endOffset: 12 }

  const before = await freshStore()
  before.setAnnotationPersistence(portFactory())
  before.bindAnnotationSession('session-1')
  before.saveAnnotation(undefined, { text: source.text, sources: [source] })
  await flush()

  const raw = storage.getItem(key('session-1'))
  if (raw === null || !raw.includes(source.text)) {
    problems.push(`${label}: save did not reach storage`)
  }

  // Reload: a fresh store over the same storage must see the annotation, with
  // its id intact — the id is the mark id, so a changed one orphans the mark.
  const after = await freshStore()
  after.setAnnotationPersistence(portFactory())
  after.adoptPersistedAnnotations('session-1')
  await flush()
  const restored = after.getAnnotations()
  if (restored.length !== 1 || restored[0].text !== source.text) {
    problems.push(`${label}: reload lost the annotation (got ${restored.length})`)
  }
  if (restored[0]?.id !== before.getAnnotations()[0]?.id) {
    problems.push(`${label}: annotation id changed across reload — marks would orphan`)
  }

  // Send gesture: clearing empties both memory and storage.
  after.clearAnnotations()
  await flush()
  if (storage.getItem(key('session-1')) !== null || after.getAnnotations().length !== 0) {
    problems.push(`${label}: clear left state behind`)
  }

  // Retention: sessions past the 7-day window go, newest N stay.
  const port = portFactory()
  const stale = Date.now() - 8 * 24 * 60 * 60 * 1000
  const freshAt = Date.now()
  for (const [sessionId, at] of [
    ['session-a', stale],
    ['session-b', stale],
    ['session-c', freshAt],
  ]) {
    const store = await freshStore()
    store.setAnnotationPersistence(port)
    store.bindAnnotationSession(sessionId)
    store.saveAnnotation(undefined, { text: `kept ${sessionId}`, sources: [{ text: 'x' }] })
    await flush()
    storage.setItem(key(sessionId), JSON.stringify({ v: 1, updatedAt: at, items: [] }))
  }
  const removed = port.prune(Date.now())
  for (const sessionId of ['session-a', 'session-b']) {
    if (storage.getItem(key(sessionId)) !== null) {
      problems.push(`${label}: retention kept stale ${sessionId}`)
    }
  }
  if (storage.getItem(key('session-c')) === null) {
    problems.push(`${label}: retention dropped a fresh session`)
  }
  if (removed.length !== 2) {
    problems.push(`${label}: retention removed ${removed.length} sessions, expected 2`)
  }
}

/** Binding a session publishes it synchronously and adopts on a microtask. */
async function checkBinding(problems) {
  const loaded = []
  const port = {
    load: (sessionId) => {
      loaded.push(sessionId)
      return sessionId === 'session-bound'
        ? [{ id: 'ann_bound', text: 'bound text', sources: [{ text: 'bound text' }] }]
        : []
    },
    save: () => {},
    clear: () => {},
    prune: () => [],
  }
  const store = await freshStore()
  store.setAnnotationPersistence(port)
  store.bindAnnotationSession('session-bound')
  if (loaded.length !== 0) {
    problems.push(`binding adopted synchronously (${loaded.length} loads before the microtask)`)
  }
  await flush()
  if (loaded.length !== 1 || loaded[0] !== 'session-bound') {
    problems.push(`binding did not adopt on the microtask (loaded: ${loaded.join(', ')})`)
  }
  const items = store.getAnnotations()
  if (items.length !== 1 || items[0].id !== 'ann_bound') {
    problems.push('binding did not surface the adopted annotation')
  }
}

/**
 * Link detection for the toolbar's "open" action (DOM-free, so it runs here).
 *
 * Only http(s) can be handed to the system browser; everything else must not
 * light up the button, and a selection that merely contains a link must not
 * either.
 */
async function checkSelectionUrl() {
  const problems = []
  const { linkTarget } = await import(
    new URL('../src/client/dom/selection-url.ts', import.meta.url).href
  )
  const cases = [
    ['https://chromewebstore.google.com/detail/x/beoonblekmppafnjppedgpgfngghebji', 'https://chromewebstore.google.com/detail/x/beoonblekmppafnjppedgpgfngghebji'],
    ['https://a.com。', 'https://a.com/'],
    ['（https://a.com）', 'https://a.com/'],
    ['  http://a.com/p?q=1#h  ', 'http://a.com/p?q=1#h'],
    ['HTTPS://A.COM', 'https://a.com/'],
    ['chrome-extension://abc/options.html', null],
    ['javascript:alert(1)', null],
    ['ftp://a.com', null],
    ['see https://a.com', null],
    ['https://a.com and more', null],
    ['plain text', null],
    ['', null],
  ]
  for (const [input, want] of cases) {
    const got = linkTarget(input)
    if (got !== want) problems.push(`linkTarget(${JSON.stringify(input)}) -> ${got}, want ${want}`)
  }
  // Selecting a link's wording must still offer the anchor's target.
  const anchorCases = [
    ['点击这里', 'https://a.com/x', 'https://a.com/x'],
    ['随便划一段', 'chrome-extension://abc/options.html', null],
    ['https://a.com/direct', 'https://ignored.example/', 'https://a.com/direct'],
    ['普通文字', null, null],
  ]
  for (const [text, href, want] of anchorCases) {
    const got = linkTarget(text, href)
    if (got !== want) problems.push(`linkTarget(${JSON.stringify(text)}, ${href}) -> ${got}, want ${want}`)
  }
  return problems
}

const MAX_ICON_BYTES = 256 * 1024
const ICON_MEDIA_TYPES = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
])
const LANGUAGE_ID = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u
const MAGIC_BYTES = [
  [Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'PNG'],
  [Buffer.from([0xff, 0xd8, 0xff]), 'JPEG'],
  [Buffer.from('RIFF', 'ascii'), 'WebP'],
]
const LOCALE_FILES = ['en.json', 'zh.json', 'ru.json']

/**
 * Package display metadata (locale + icon), checked the way the host reads it.
 *
 * The plugin manager resolves `<name>/locale/en.json`, every sibling `*.json`
 * in that directory, `<name>/icon` and `<name>/package.json` through the Node
 * ESM resolver — without activating the plugin — and every rule below mirrors
 * one of its checks: a language-id filename, one dictionary per language, all
 * locale files in the English file's directory, non-empty `meta` strings, a
 * bounded image of an allowed type inside the package, and exports / `files`
 * entries that actually reach the packed tarball.
 *
 * Resolution goes through `require.resolve` with the package's own name, which
 * is exactly the host's path (Node self-reference) and therefore fails the same
 * way a missing or mistyped `exports` entry fails there.
 */
function checkPackageMeta() {
  const problems = []
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const exportsMap = manifest.exports ?? {}
  const files = new Set(manifest.files ?? [])

  for (const [specifier, target] of [
    ['./locale/*.json', './locale/*.json'],
    ['./icon', './icon.svg'],
  ]) {
    if (exportsMap[specifier] !== target) {
      problems.push(`exports["${specifier}"] must be "${target}" (host resolves display resources through it)`)
    }
  }
  for (const entry of ['locale/*.json', 'icon.svg']) {
    if (!files.has(entry)) problems.push(`files[] lacks "${entry}" — the tarball would ship without it`)
  }

  // Resolution through the package's own name, as the host does.
  const resolveSelf = (specifier) => {
    try {
      return require.resolve(specifier)
    } catch (error) {
      problems.push(`resolve("${specifier}") failed: ${error.code ?? error.message}`)
      return null
    }
  }
  const englishPath = resolveSelf('dsh-select-quote/locale/en.json')
  const iconPath = resolveSelf('dsh-select-quote/icon')
  resolveSelf('dsh-select-quote/package.json')

  // Locale dictionaries: the host enumerates the directory, so every *.json in
  // it is a dictionary — an extra or malformed file becomes a row diagnostic.
  const localeDir = resolve(root, 'locale')
  let entries = []
  try {
    entries = readdirSync(localeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
  } catch {
    problems.push('locale/ directory is missing — no display metadata at all')
  }
  for (const name of LOCALE_FILES) {
    if (!entries.includes(name)) problems.push(`locale/${name} is missing`)
  }
  for (const name of entries) {
    const language = name.slice(0, -5)
    if (!LANGUAGE_ID.test(language)) {
      problems.push(`locale/${name}: "${language}" is not a language id filename`)
      continue
    }
    const file = resolveSelf(`dsh-select-quote/locale/${name}`)
    if (file === null) continue
    if (englishPath !== null && dirname(file) !== dirname(englishPath)) {
      problems.push(`locale/${name} resolves outside the English locale directory`)
    }
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      problems.push(`locale/${name}: ${String(error)}`)
      continue
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      problems.push(`locale/${name} must contain an object`)
      continue
    }
    const meta = parsed.meta
    if (meta !== undefined && (typeof meta !== 'object' || meta === null || Array.isArray(meta))) {
      problems.push(`locale/${name}: meta must be an object`)
      continue
    }
    for (const field of ['title', 'description']) {
      const value = meta?.[field]
      if (value === undefined) {
        problems.push(`locale/${name}: meta.${field} is missing — the row would fall back to package.json`)
      } else if (typeof value !== 'string' || value.trim() === '') {
        problems.push(`locale/${name}: meta.${field} must be a non-empty string`)
      }
    }
  }

  // Icon: the host turns it into a data URL, so the bytes must render.
  if (iconPath !== null) {
    const inside = relative(root, iconPath)
    if (inside.startsWith('..') || resolve(root, inside) !== iconPath) {
      problems.push('icon resolves outside the package')
    }
    const mediaType = ICON_MEDIA_TYPES.get(extname(iconPath).toLowerCase())
    if (mediaType === undefined) {
      problems.push(`icon must be SVG, PNG, JPEG, or WebP (got ${extname(iconPath)})`)
    } else {
      const size = statSync(iconPath).size
      if (size > MAX_ICON_BYTES) problems.push(`icon is ${size} bytes, over the 256 KiB limit`)
      const bytes = readFileSync(iconPath)
      if (mediaType === 'image/svg+xml') {
        const svg = bytes.toString('utf8')
        if (!/^\s*<svg[\s>]/.test(svg)) problems.push('icon.svg: root element is not <svg>')
        if (!svg.includes('viewBox')) problems.push('icon.svg: no viewBox — scaling is undefined')
        if (!/<\/svg>\s*$/.test(svg)) problems.push('icon.svg: no closing </svg>')
        if (/<script/i.test(svg)) problems.push('icon.svg: scripts are not rendered as an image')
        if (/(?:xlink:href|href|src)\s*=\s*["']https?:/i.test(svg) || /url\(\s*["']?https?:/i.test(svg)) {
          problems.push('icon.svg: external references are not resolvable from a data URL')
        }
      } else {
        const [magic, label] = MAGIC_BYTES.find(([prefix]) => bytes.subarray(0, prefix.length).equals(prefix)) ?? []
        if (!magic) problems.push(`icon bytes are not a valid ${mediaType}`)
        if (label === 'WebP' && !bytes.subarray(8, 12).toString('ascii').startsWith('WEBP')) {
          problems.push('icon bytes are not a valid image/webp')
        }
      }
    }
  }

  // The packed file list is the only thing that ships.
  const packed = packedFiles()
  if (packed !== null) {
    for (const path of [
      'package.json',
      'cordis.patch.yml',
      'lib/index.js',
      'lib/client.js',
      'icon.svg',
      'locale/en.json',
      'locale/zh.json',
      'locale/ru.json',
    ]) {
      if (!packed.includes(path)) problems.push(`npm pack would not ship ${path}`)
    }
  }
  return problems
}

/** `npm pack --dry-run --json` file paths, or null when npm cannot run. */
function packedFiles() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error !== undefined) {
    console.error(`PACK: npm pack could not run (${result.error.message}) — the tarball list is unverified`)
    return null
  }
  if (result.status !== 0) {
    console.error(`PACK: npm pack exited ${result.status} — the tarball list is unverified`)
    return null
  }
  // One pack target prints a bare object; several print an array. Notices may
  // trail the JSON, so trim to the outermost braces.
  const start = result.stdout.search(/[{[]/)
  const end = Math.max(result.stdout.lastIndexOf('}'), result.stdout.lastIndexOf(']'))
  const parsed = JSON.parse(result.stdout.slice(start, end + 1))
  const summary = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0]
  return summary?.files?.map((file) => file.path) ?? null
}

async function checkPersistence() {
  const problems = []
  const { createStoragePersistence } = await import(
    new URL('../src/client/state/annotation-persistence.ts', import.meta.url).href
  )
  const plainStorage = memoryStorage()
  await replay(() => createStoragePersistence(plainStorage), plainStorage, problems, 'localStorage')
  await checkBinding(problems)
  return problems
}

/** Map-backed `KeyValueStorage`: the port the backend runs on. */
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  }
}

/** localStorage facade for the bundle sandbox, sharing one Map. */
function localStorageFacade(storage) {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
    get length() {
      return storage.keys().length
    },
    key: (index) => storage.keys()[index] ?? null,
  }
}

function loadFactory(code, storage) {
  let definition
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value
        },
      },
    },
    localStorage: localStorageFacade(storage),
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
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

/**
 * Reject `dataset[<dashed>]` writes.
 *
 * Assigning a key that is not a valid JavaScript identifier throws
 * `SyntaxError: ... is not a valid property name` out of DOMStringMap. That
 * aborts the caller, so one such write inside the chip decoration used to
 * silently kill the whole feature (and the `data-dsq-deco` marker set right
 * after it, which `message-text.ts` relies on to skip decorated nodes) — with
 * no DOM here, only this static read of the artifact catches it.
 */
function checkDatasetKeys(code) {
  const problems = []
  const validKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/
  const reported = new Set()
  for (const match of code.matchAll(/\.dataset\[("([^"]*)"|'([^']*)'|([A-Za-z_$][A-Za-z0-9_$]*))\]/g)) {
    const literal = match[2] ?? match[3]
    let value = literal
    let label = match[1]
    if (literal === undefined) {
      // Bracket access through a constant: resolve the literal it is bound to.
      const definition = new RegExp(`(?:const|var|let)\\s+${match[4]}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(code)
      // A dynamic or non-literal key cannot be judged statically.
      if (!definition) continue
      value = definition[1]
      label = match[4]
    }
    if (validKey.test(value) || reported.has(label)) continue
    reported.add(label)
    problems.push(`dataset[${label}] is "${value}" — DOMStringMap needs a valid identifier`)
  }
  return problems
}

const storage = memoryStorage()
/**
 * The directives observer must react to characterData records.
 *
 * A streaming reply lands as an in-place text mutation, and such records carry
 * no added nodes — a callback that only walks `addedNodes` leaves the raw
 * `:dsh-annotation{index="N"}` on screen until the message DOM is re-created
 * (session switch, remount). Verified live: with the branch missing, a
 * `nodeValue` write never produced a chip.
 */
function checkDirectiveObserver(code) {
  const problems = []
  if (!/record\.type\s*===\s*['"]characterData['"]/.test(code)) {
    problems.push('directives observer ignores characterData records — streaming text is never decorated')
  }
  return problems
}

const code = readFileSync(resolve(root, 'lib/client.js'), 'utf8')
const bundle = loadFactory(code, storage)
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
const datasetProblems = checkDatasetKeys(code)
const observerProblems = checkDirectiveObserver(code)

for (const entry of record) console.log(`  ${entry.kind.padEnd(16)} ${entry.label}`)

const languages = new Set()
for (const perLocale of dicts.values()) for (const locale of perLocale.keys()) languages.add(locale)

const persistenceProblems = await checkPersistence()
const linkProblems = await checkSelectionUrl()
const metaProblems = checkPackageMeta()

for (const entry of record) console.log(`  ${entry.kind.padEnd(16)} ${entry.label}`)

if (
  missing.length > 0 ||
  broken.length > 0 ||
  dictionaryProblems.length > 0 ||
  datasetProblems.length > 0 ||
  observerProblems.length > 0 ||
  persistenceProblems.length > 0 ||
  linkProblems.length > 0 ||
  metaProblems.length > 0
) {
  for (const entry of missing) console.error(`MISSING: ${entry.kind} ${entry.label}`)
  for (const entry of broken) console.error(`NOT A COMPONENT: ${entry.label}`)
  for (const problem of dictionaryProblems) console.error(`DICTIONARY: ${problem}`)
  for (const problem of datasetProblems) console.error(`DATASET KEY: ${problem}`)
  for (const problem of observerProblems) console.error(`DIRECTIVE OBSERVER: ${problem}`)
  for (const problem of persistenceProblems) console.error(`PERSISTENCE: ${problem}`)
  for (const problem of linkProblems) console.error(`LINK: ${problem}`)
  for (const problem of metaProblems) console.error(`PACKAGE META: ${problem}`)
  process.exit(1)
}
console.log(
  `ok: ${EXPECTED.length} contributions registered, ${module.inject.join(', ')} injected, ` +
    `copy complete for ${[...languages].sort().join('/')}, annotation persistence replayed, link detection replayed, ` +
    `package metadata (locale + icon) resolved and packed`,
)
