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
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))

/** Everything this plugin is expected to contribute when it is mounted. */
const EXPECTED = [
  { kind: 'slots.register', label: 'shell.overlay / select-quote-toolbar' },
  { kind: 'slots.register', label: 'conversation.input.overlay / select-quote-card' },
  { kind: 'slots.register', label: 'conversation.input.overlay / select-quote-session-bridge' },
  { kind: 'slots.register', label: 'conversation.chat.node / user' },
  { kind: 'slots.register', label: 'conversation.chat.node / steering' },
  { kind: 'slots.register', label: 'plugins.bundle.config / dsh-select-quote' },
  { kind: 'locale.language', label: 'ja' },
  { kind: 'locale.language', label: 'es' },
  { kind: 'locale.language', label: 'fr' },
  { kind: 'locale.language', label: 'de' },
  { kind: 'locale.language', label: 'ru' },
  { kind: 'locale.language', label: 'pt' },
  { kind: 'locale.register', label: 'select-quote (en, zh)' },
  { kind: 'locale.register', label: 'select-quote (ja)' },
  { kind: 'locale.register', label: 'select-quote (es)' },
  { kind: 'locale.register', label: 'select-quote (fr)' },
  { kind: 'locale.register', label: 'select-quote (de)' },
  { kind: 'locale.register', label: 'select-quote (ru)' },
  { kind: 'locale.register', label: 'select-quote (pt)' },
  { kind: 'locale.bind', label: 'select-quote' },
]

/** Baseline languages every host ships; both must land in one typed call. */
const SHIPPED_LOCALES = ['en', 'zh']

/** Language packs the host ships from 0.2.2-alpha.2 on, in its own order. */
const HOST_LANGUAGE_PACKS = ['ja', 'es', 'fr', 'de', 'ru', 'pt']

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

  // A fork mints a brand-new session id with nothing stored under it: adoption
  // is a no-op, yet the rebind must still publish, so the pending-mark sync
  // re-reads the new partition and the previous session's marks drop instead
  // of bleeding into the forked transcript while the composer card is gone.
  const seen = []
  const unsubscribe = store.subscribeAnnotations(() => seen.push(store.getAnnotations().length))
  store.bindAnnotationSession('session-fork')
  await flush()
  if (seen.length !== 1 || seen[0] !== 0) {
    problems.push(`rebind to an empty session did not republish once (${seen.join(', ')})`)
  }
  if (store.getAnnotations().length !== 0) {
    problems.push('rebind to an empty session kept annotations from the previous one')
  }
  if (store.getAnnotations('session-bound').length !== 1) {
    problems.push('rebind dropped the parked partition of the previous session')
  }
  unsubscribe()

  // Two binds in the same tick: only the last one is active, so only it may
  // be adopted — the superseded bind must not publish a stale partition.
  loaded.length = 0
  store.bindAnnotationSession('session-rapid-a')
  store.bindAnnotationSession('session-rapid-b')
  await flush()
  if (loaded.includes('session-rapid-a')) {
    problems.push('superseded bind still adopted its session')
  }
  if (!loaded.includes('session-rapid-b')) {
    problems.push('active bind did not adopt its session')
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

/**
 * The replaced `user` node must delegate to the host's own node view.
 *
 * The shipped `UserMessageNodeView` renders the bubble/content factory and the
 * time/copy `MessageIconActions` row as siblings. A private bubble that
 * redraws the chrome silently drops the clock, the copy button, every plugin
 * that portals into that row (dsh-rewind's ↶), and stops following host
 * changes. So the built artifact must resolve and render `UserMessageNodeView`
 * (with its `chat` translator) and must not carry a private actions row.
 * `renderMessageImages` is not a host prop in 0.2.1-rc.2 at all.
 */
function checkUserChrome(code) {
  const problems = []
  if (!/["']UserMessageNodeView["']/.test(code) || !code.includes('conversation.chat.node')) {
    problems.push(
      'replacement user node does not resolve the host UserMessageNodeView — chrome stops following the host',
    )
  }
  if (!/locale:\s*["']chat["']/.test(code)) {
    problems.push('delegated host node view is registered without the chat locale seat (copy labels break)')
  }
  if (code.includes('dsq_userActions')) {
    problems.push('user node redraws the actions row instead of delegating it to the host')
  }
  if (code.includes('renderMessageImages')) {
    problems.push('renderMessageImages is not a host prop — pass the node through the host view')
  }
  if (!code.includes('isSubmitKey')) {
    problems.push('composer send intercept does not use isSubmitKey — modified Enter gestures skip the fold')
  }
  if (!/addEventListener\(["']storage["']/.test(code)) {
    problems.push('annotation store has no storage listener — another tab can overwrite newer state')
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
const LOCALE_FILES = [
  'en.json',
  'zh.json',
  'ja.json',
  'es.json',
  'fr.json',
  'de.json',
  'ru.json',
  'pt.json',
]

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
      'locale/ja.json',
      'locale/es.json',
      'locale/fr.json',
      'locale/de.json',
      'locale/ru.json',
      'locale/pt.json',
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

/**
 * Every host submit gesture must fold annotations before the composer reads
 * its draft. Plain Enter, Ctrl+Enter and Meta+Enter submit; Shift+Enter,
 * Alt/AltGraph, the two modifiers together, and IME are not submits.
 */
async function checkSendKey() {
  const problems = []
  const { isSubmitKey } = await import(
    new URL('../src/client/dom/composer-host.ts', import.meta.url).href
  )
  const base = {
    key: 'Enter',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
  }
  const key = (over) => ({ ...base, ...over })
  for (const [name, event] of [
    ['Enter', key({})],
    ['Ctrl+Enter', key({ ctrlKey: true })],
    ['Meta+Enter', key({ metaKey: true })],
  ]) {
    if (!isSubmitKey(event)) problems.push(`${name} is not treated as a submit gesture`)
  }
  for (const [name, event] of [
    ['Shift+Enter', key({ shiftKey: true })],
    ['Alt+Enter', key({ altKey: true })],
    ['Ctrl+Meta+Enter', key({ ctrlKey: true, metaKey: true })],
    ['Shift+Meta+Enter', key({ shiftKey: true, metaKey: true })],
    ['IME Enter', key({ isComposing: true })],
    ['non-Enter', key({ key: 'a' })],
    [
      'AltGraph Enter',
      { ...key({}), getModifierState: (name) => name === 'AltGraph' },
    ],
  ]) {
    if (isSubmitKey(event)) problems.push(`${name} would fold annotations for a non-submit gesture`)
  }
  return problems
}

/**
 * The composer-side inverse of the send fold.
 *
 * dsh-rewind refills a withdrawn message verbatim — it reads the durable text
 * blocks and writes them into the composer, so the protocol block comes back
 * too. The composer must recover the annotations (with their source locators)
 * and the user's own text instead of showing a wall of JSON. Replay
 * compose → rewind text → read here, without a DOM.
 */
async function checkComposedDraft() {
  const problems = []
  const { composeAnnotatedMessage, readComposedDraft, scanAnnotatedMessage } = await import(
    new URL('../src/client/protocol/annotation-protocol.ts', import.meta.url).href
  )
  const source = {
    text: '被划中的原文',
    messageId: 'flow-42',
    messageKind: 'assistant',
    startOffset: 3,
    endOffset: 11,
  }
  const annotations = [
    { id: 'a1', text: source.text, comment: '这里要改', sources: [source] },
    {
      id: 'a2',
      text: '另一段',
      sources: [{ text: '另一段' }, { text: '另一段', messageId: 'flow-7' }],
    },
  ]
  const restored = readComposedDraft(composeAnnotatedMessage('用户正文', annotations))
  if (restored === null) {
    problems.push('a composed message was not recognized as an annotation block')
    return problems
  }
  if (restored.rest !== '用户正文') {
    problems.push(`restored draft is ${JSON.stringify(restored.rest)}, want "用户正文"`)
  }
  if (restored.annotations.length !== 2) {
    problems.push(`restored ${restored.annotations.length} annotations, want 2`)
  }
  const [first, second] = restored.annotations
  if (first?.text !== source.text || first?.comment !== '这里要改') {
    problems.push('first annotation lost its text/comment')
  }
  if (first?.sources[0]?.messageId !== 'flow-42' || first?.sources[0]?.startOffset !== 3) {
    problems.push('first annotation lost its source locator — the mark would not come back')
  }
  if (second?.sources.length !== 2) {
    problems.push('multi-source annotation lost a source')
  }
  // Only complete, valid blocks may touch the editor.
  for (const text of [
    '只提到 <response-annotations> 的普通草稿',
    '<response-annotations>{oops}</response-annotations>',
    '<response-annotations>[]</response-annotations>',
  ]) {
    if (readComposedDraft(text) !== null) {
      problems.push(`readComposedDraft edited a non-restorable draft: ${text}`)
    }
  }
  // A block with text on both sides keeps both sides.
  const middle = readComposedDraft(
    '前文\n\n<response-annotations>[{"text":"x"}]</response-annotations>\n\n后文',
  )
  if (middle === null || middle.rest !== '前文\n\n后文') {
    problems.push(`middle placement restored ${JSON.stringify(middle?.rest)}`)
  }
  // A close marker inside selected text or a comment must not end the block
  // early — new drafts escape it, legacy drafts still carry it literally.
  const markerText = '原文里有 </response-annotations> 与 <response-annotations>'
  const markerComment = '评论里也写 </response-annotations>'
  const tricky = [{ id: 'a3', text: markerText, comment: markerComment, sources: [{ text: markerText }] }]
  const trickyRead = readComposedDraft(composeAnnotatedMessage('含标记的正文', tricky))
  if (trickyRead === null) {
    problems.push('a close marker inside an annotation string broke the composed block')
  } else {
    if (trickyRead.rest !== '含标记的正文') {
      problems.push(`tricky draft restored ${JSON.stringify(trickyRead.rest)}`)
    }
    if (trickyRead.annotations[0]?.text !== markerText) {
      problems.push('tricky draft lost the selected text')
    }
    if (trickyRead.annotations[0]?.comment !== markerComment) {
      problems.push('tricky draft lost the comment')
    }
  }
  const legacyDraft =
    `<response-annotations>${JSON.stringify([{ text: markerText, annotation: markerComment }])}` +
    `</response-annotations>\n\n含标记的正文`
  const legacyRead = readComposedDraft(legacyDraft)
  if (legacyRead === null || legacyRead.annotations[0]?.text !== markerText) {
    problems.push('a legacy block with a literal close marker did not read back')
  }
  const legacyScan = scanAnnotatedMessage(legacyDraft)
  if (legacyScan.annotations.length !== 1 || legacyScan.rest !== '含标记的正文') {
    problems.push(`legacy block display is ${JSON.stringify({ n: legacyScan.annotations.length, rest: legacyScan.rest })}`)
  }
  // The display layer must strip a complete block even when its payload is
  // unreadable or not an array. readComposedDraft stays conservative (above);
  // scanAnnotatedMessage only loses the annotation, never the markers.
  for (const [text, want] of [
    ['<response-annotations>{oops}</response-annotations>', ''],
    ['<response-annotations>{"text":"x"}</response-annotations>', ''],
    ['前文\n\n<response-annotations>[1, 2] trailing</response-annotations>\n\n后文', '前文\n\n后文'],
    [
      '# Response annotations:\n\n<response-annotations>{oops}</response-annotations>\n\n正文',
      '正文',
    ],
  ]) {
    const scan = scanAnnotatedMessage(text)
    if (scan.annotations.length !== 0) {
      problems.push(`a malformed block produced annotations: ${text}`)
    }
    if (scan.rest !== want) {
      problems.push(`malformed block display is ${JSON.stringify(scan.rest)}, want ${JSON.stringify(want)}`)
    }
  }
  return problems
}

/** The rewind restore must be wired into the built bundle, not just exported. */
function checkRewindRestore(code) {
  const problems = []
  if (!code.includes('readComposedDraft')) {
    problems.push(
      'composer has no rewind restore — a withdrawn message refills the editor with the whole protocol block',
    )
  }
  if (!code.includes('restoreAnnotations')) {
    problems.push(
      'rewind restore does not re-adopt annotations — resending would silently drop the selections',
    )
  }
  return problems
}

/**
 * Surfaces that bypass the chat-node slot.
 *
 * The optimistic submission echo (`[data-submission-echo]`) and queued-message
 * previews (`[data-queue-dock]`) are painted by the chat flow from the draft
 * or wire content, so both show the protocol block — they must be stripped in
 * place. History annotations group into ONE summary block per message (count +
 * hover list), never one card per annotation.
 */
function checkTranscriptSurfaces(code) {
  const problems = []
  if (!code.includes('data-submission-echo')) {
    problems.push('submission echo is not stripped — a slow turn shows the raw protocol block')
  }
  if (!code.includes('data-queue-dock') || !code.includes('stripQueueDock')) {
    problems.push('queue dock preview is not stripped — a queued send shows the raw protocol block')
  }
  if (!code.includes('dsq_tSummary')) {
    problems.push('transcript summary block is missing — annotations must group into one block')
  }
  if (code.includes('dsq_tCardStack')) {
    problems.push('per-annotation transcript cards are back — one block with a hover list is the contract')
  }
  if (!code.includes('--dsq-ann-badge-x') || !code.includes('--dsq-ann-badge-y')) {
    problems.push('badge collision offsets are not wired into the annotation mark')
  }
  if (!code.includes('dsh-select-quote: mark preview') || !code.includes('mark.previewAria')) {
    problems.push('transcript marks have no click/keyboard preview')
  }
  return problems
}

/**
 * The host lookup must exclude this plugin's own registration by identity,
 * not by the priority value that happens to win the slot election, and it
 * must never delegate to an arbitrary wrapper when the host is ambiguous.
 */
async function checkHostNode() {
  const problems = []
  const { pickHostNode } = await import(
    new URL('../src/client/transcript/host-user.ts', import.meta.url).href
  )
  const self = function UserNode() {}
  const host = function UserMessageNodeView() {}
  const other = function OtherUserNode() {}
  const third = function ThirdUserNode() {}
  const entry = (component, priority, key = 'user') => ({
    component,
    options: { key, ...(priority === undefined ? {} : { priority }) },
  })
  // memo() is an object whose `type` carries the function name.
  const memoHost = { type: host }

  if (pickHostNode([entry(self, -10), entry(host)], self, 'user') !== host) {
    problems.push('the named host user view was not resolved')
  }
  if (pickHostNode([entry(self, -10), entry(memoHost)], self, 'user') !== memoHost) {
    problems.push('a memo-wrapped host user view was not resolved')
  }
  if (pickHostNode([entry(self, -10)], self, 'user') !== undefined) {
    problems.push('the plugin resolved its own registration as the host')
  }
  if (pickHostNode([entry(self, -10), entry(other, -1)], self, 'user') !== other) {
    problems.push('a renamed host with one non-self candidate was not used')
  }
  if (
    pickHostNode([entry(self, -10), entry(other, -1), entry(third, 0)], self, 'user') !== undefined
  ) {
    problems.push('ambiguous host candidates were guessed instead of falling back')
  }
  if (
    pickHostNode([entry(self, -10), entry(host), entry(other, -1)], self, 'user') !== host
  ) {
    problems.push('another user wrapper beat the named host view')
  }
  // The host registers the same component under steering; the lookup must not
  // borrow the user entry (and vice versa).
  if (pickHostNode([entry(host, 0, 'steering'), entry(other, 0, 'user')], self, 'steering') !== host) {
    problems.push('the steering host view was not resolved by key')
  }
  if (
    pickHostNode([entry(host, 0, 'user'), entry(other, 0, 'steering')], self, 'steering') !== other
  ) {
    problems.push('a steering lookup resolved the user view')
  }
  return problems
}

/**
 * Echo stripping is display-only and must be idempotent: the host may re-render
 * the echo row after the first pass. A run split across siblings is not rebuilt.
 */
async function checkEchoStrip() {
  const problems = []
  const { composeAnnotatedMessage } = await import(
    new URL('../src/client/protocol/annotation-protocol.ts', import.meta.url).href
  )
  const { stripEchoRow, stripQueueDock } = await import(
    new URL('../src/client/dom/stripSubmissionEcho.ts', import.meta.url).href
  )
  const block = composeAnnotatedMessage('用户正文', [
    { id: 'a1', text: '被划中的原文', comment: '这里要改', sources: [{ text: '被划中的原文' }] },
  ])
  const leaf = (text) => ({ children: [], textContent: text, querySelectorAll: () => [] })
  const row = (children) => ({
    children,
    textContent: children.map((child) => child.textContent).join(''),
    querySelectorAll: () => children,
  })

  const run = leaf(block)
  const wrapped = row([run])
  if (!stripEchoRow(wrapped)) problems.push('a wrapped protocol run was not stripped')
  if (run.textContent !== '用户正文') {
    problems.push(`stripped echo is ${JSON.stringify(run.textContent)}, want "用户正文"`)
  }
  if (stripEchoRow(wrapped)) problems.push('stripping the same echo twice was not idempotent')

  const bare = leaf(block)
  if (!stripEchoRow(bare) || bare.textContent !== '用户正文') {
    problems.push('an echo whose row itself is the text run was not stripped')
  }

  const header = leaf('# Response annotations:\n\n')
  const body = leaf(block.slice(block.indexOf('<response-annotations>')))
  const split = row([header, body])
  if (!stripEchoRow(split) || body.textContent !== '用户正文') {
    problems.push('the protocol run beside an instructional header was not stripped')
  }
  if (header.textContent !== '# Response annotations:\n\n') {
    problems.push('stripping the protocol run touched the instructional header')
  }

  const open = leaf('<response-annotations>')
  const close = leaf('</response-annotations>')
  const across = row([open, close])
  if (stripEchoRow(across)) problems.push('a marker pair split across siblings was rebuilt')
  if (open.textContent !== '<response-annotations>' || close.textContent !== '</response-annotations>') {
    problems.push('a marker pair split across siblings was mutated')
  }

  // Queue previews come from the host's word-splitting text factory: the
  // markers live in different leaves, so the flat echo strategy cannot see a
  // complete block. The innermost text container must be rewritten instead,
  // one per queued row, leaving sibling actions untouched.
  const branch = (children, text) => {
    const descendants = children.flatMap((child) => [
      child,
      ...Array.from(child.querySelectorAll('*')),
    ])
    const node = {
      children,
      querySelectorAll: () => descendants,
      contains: (other) => descendants.includes(other),
    }
    if (text === undefined) {
      Object.defineProperty(node, 'textContent', {
        get: () => children.map((child) => child.textContent).join(''),
      })
    } else {
      node.textContent = text
    }
    return node
  }
  const previewOf = (source) => {
    const words = [
      leaf(source.slice(0, Math.floor(source.length / 2))),
      leaf(source.slice(Math.floor(source.length / 2))),
    ]
    return branch(words, source)
  }
  const firstText = previewOf(block)
  const secondText = previewOf(block.replace('用户正文', '第二条正文'))
  const action = leaf('')
  const firstRow = branch([firstText, action])
  const secondRow = branch([secondText])
  const dock = branch([firstRow, secondRow])
  if (!stripQueueDock(dock)) problems.push('queue dock previews were not stripped')
  if (firstText.textContent !== '用户正文' || secondText.textContent !== '第二条正文') {
    problems.push('a queue dock with two previews kept protocol text')
  }
  if (firstRow.children.length !== 2 || firstRow.children[1] !== action) {
    problems.push('stripping a queue preview rebuilt the whole row')
  }
  if (stripQueueDock(dock)) problems.push('stripping the same queue dock twice was not idempotent')

  // A complete block with unreadable or non-array JSON is still protocol text:
  // the echo must drop it rather than painting the payload.
  for (const broken of [
    '<response-annotations>{oops}</response-annotations>\n\n用户正文',
    '<response-annotations>{"text":"x"}</response-annotations>\n\n用户正文',
  ]) {
    const run = leaf(broken)
    if (!stripEchoRow(row([run])) || run.textContent !== '用户正文') {
      problems.push(`a malformed complete block survived the echo strip: ${broken}`)
    }
  }
  return problems
}

async function checkPersistence() {
  const problems = []
  const { createStoragePersistence } = await import(
    new URL('../src/client/state/annotation-persistence.ts', import.meta.url).href
  )
  const plainStorage = memoryStorage()
  await replay(() => createStoragePersistence(plainStorage), plainStorage, problems, 'localStorage')
  await checkBinding(problems)
  await checkCrossTab(problems)
  return problems
}

/**
 * Two tabs, one localStorage. A write in one tab must be adopted by the other;
 * once a tab sends (clear), the stale tab must not re-persist the old array.
 */
async function checkCrossTab(problems) {
  const { createStoragePersistence } = await import(
    new URL('../src/client/state/annotation-persistence.ts', import.meta.url).href
  )
  const storage = memoryStorage()
  const key = 'dsh.select-quote.annotations.session-tabs'
  const tabA = await freshStore()
  const tabB = await freshStore()
  tabA.setAnnotationPersistence(createStoragePersistence(storage))
  tabB.setAnnotationPersistence(createStoragePersistence(storage))
  tabA.bindAnnotationSession('session-tabs')
  tabB.bindAnnotationSession('session-tabs')
  await flush()

  tabA.saveAnnotation(undefined, { text: 'tab A item', sources: [{ text: 'tab A item' }] })
  await flush()
  tabB.adoptStorageAnnotations('session-tabs')
  if (tabB.getAnnotations().length !== 1 || tabB.getAnnotations()[0]?.text !== 'tab A item') {
    problems.push('cross-tab: a write in tab A was not adopted by tab B')
  }

  // A sends: its clear is the newest state. B must drop the stale copy, and a
  // later B write must not resurrect what A already sent.
  tabA.clearAnnotations()
  await flush()
  tabB.adoptStorageAnnotations('session-tabs')
  if (tabB.getAnnotations().length !== 0) {
    problems.push('cross-tab: tab B kept annotations tab A already sent')
  }
  tabB.saveAnnotation(undefined, { text: 'tab B item', sources: [{ text: 'tab B item' }] })
  await flush()
  const stored = JSON.parse(storage.getItem(key) ?? 'null')
  if (!stored || stored.items.length !== 1 || stored.items[0].text !== 'tab B item') {
    problems.push('cross-tab: a stale tab resurrected sent annotations')
  }

  // A write from the other tab reaches this one.
  tabB.saveAnnotation(undefined, { text: 'tab B second', sources: [{ text: 'tab B second' }] })
  await flush()
  tabA.adoptStorageAnnotations('session-tabs')
  if (tabA.getAnnotations().length !== 2) {
    problems.push('cross-tab: a concurrent write in tab B was not adopted by tab A')
  }

  // localStorage.clear() reports key === null; held partitions must go too.
  storage.removeItem(key)
  tabA.adoptStorageAnnotations(null)
  if (tabA.getAnnotations().length !== 0) {
    problems.push('cross-tab: localStorage.clear() left a stale partition')
  }
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
      addEventListener() {},
      removeEventListener() {},
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

function mockContext(record, options = {}) {
  /** Registered copy: namespace -> locale -> key -> template. */
  const dicts = new Map()
  const hostLanguages = options.hostLocales ?? ['en']
  const snapshot = {
    active: 'en',
    locales: hostLanguages.map((id) => ({ id, label: id, fallback: 'en' })),
    revision: 0,
  }
  const ctx = {
    effect(callback, label) {
      record.push({ kind: 'effect', label: String(label) })
      return typeof callback() === 'function' ? () => {} : () => {}
    },
    get() {
      return undefined
    },
    /** Cordis runs the callback only once every listed service exists. */
    inject(deps, callback) {
      record.push({ kind: 'inject', label: deps.join(', ') })
      if (!deps.every((dep) => ctx[dep] !== undefined)) return
      callback(ctx)
    },
  }
  if (options.configForms !== undefined) ctx.configForms = options.configForms
  if (options.shortcuts !== undefined) ctx.shortcuts = options.shortcuts
  ctx.slots = {
    inject(key, callback) {
      record.push({ kind: 'slots.inject', label: key })
      return callback()
    },
    register(options, component) {
      const cell = options.key ?? options.id
      record.push({ kind: 'slots.register', label: `${options.name} / ${cell}`, component, options })
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
      // The Host throws on a duplicate id; a silent overwrite would hide the
      // boot failure this guard exists to prevent.
      if (snapshot.locales.some((language) => language.id === definition.id)) {
        throw new Error(`locale "${definition.id}" is already registered`)
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

/** A Host config-form stand-in: one namespace, one form, live snapshots. */
function fakeConfigForms(value) {
  const listeners = new Set()
  const snapshot = { status: 'ready', value, base: {}, user: {}, revision: 0, writable: true }
  const notify = () => {
    for (const fn of [...listeners]) fn()
  }
  const form = {
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    set(field, next) {
      snapshot.value = { ...snapshot.value, [field]: next }
      snapshot.revision += 1
      notify()
      return Promise.resolve(true)
    },
  }
  const service = {
    get(entryId) {
      if (entryId !== 'select-quote') {
        throw new Error(`client read config form "${entryId}", want the Loader row id`)
      }
      return form
    },
    describe() {
      return { getSnapshot: () => ({ view: { namespaces: [{ ns: 'select-quote' }] } }) }
    },
    whileServed(namespaces, register) {
      if (!namespaces.includes('select-quote')) {
        throw new Error(`settings page follows [${namespaces.join(', ')}], want select-quote`)
      }
      return register(new Set(['select-quote']))
    },
  }
  return {
    service,
    subscriberCount: () => listeners.size,
    set(next) {
      snapshot.value = next
      snapshot.revision += 1
      for (const fn of [...listeners]) fn()
    },
  }
}

/**
 * Right-click ownership: the predicate must stand down for every other owner
 * and only claim a point that sits on a transcript selection.
 */
async function checkMenuTrigger() {
  const problems = []
  const { pointInRects, shouldOpenSelectionMenu } = await import(
    new URL('../src/client/dom/menu-trigger.ts', import.meta.url).href
  )
  const open = {
    defaultPrevented: false,
    contextMenuEnabled: true,
    touch: false,
    targetInTranscript: true,
    pointInSelection: true,
    hasSelection: true,
  }
  if (!shouldOpenSelectionMenu(open)) {
    problems.push('a claimed right-click on a transcript selection was refused')
  }
  for (const [field, blocking, label] of [
    ['defaultPrevented', true, 'another listener already prevented the menu'],
    ['contextMenuEnabled', false, 'the right-click entry is off'],
    ['touch', true, 'the pointer is coarse'],
    ['targetInTranscript', false, 'the target is app chrome'],
    ['pointInSelection', false, 'the point is off the selection'],
    ['hasSelection', false, 'the selection is collapsed'],
  ]) {
    if (shouldOpenSelectionMenu({ ...open, [field]: blocking })) {
      problems.push(`a right-click was claimed although ${label} (${field})`)
    }
  }

  const rects = [
    { left: 10, top: 10, right: 100, bottom: 20 },
    { left: 10, top: 30, right: 60, bottom: 40 },
  ]
  for (const [x, y, want] of [
    [50, 15, true],
    [50, 25, false],
    [102, 15, true],
    [103, 15, false],
    [5, 15, false],
    [20, 39, true],
  ]) {
    const got = pointInRects(x, y, rects)
    if (got !== want) problems.push(`pointInRects(${x}, ${y}) -> ${got}, want ${want}`)
  }
  if (pointInRects(50, 15, [])) problems.push('pointInRects matched an empty rect list')
  return problems
}

/**
 * Badge collision geometry: identical or nearby endpoints must not paint two
 * ordinals on the same pixels, and edge bounds must move the stack upward
 * instead of off-screen.
 */
/** The Host shortcut commands: defaults, regions, and selection gating. */
async function checkShortcutCommands() {
  const problems = []
  const mod = await import(new URL('../src/client/shortcut-menu.ts', import.meta.url).href)
  const { runtime } = await import(new URL('../src/client/runtime.ts', import.meta.url).href)
  const menu = mod.selectionMenuCommand()
  const add = mod.addToTaskCommand()

  if (menu.id !== 'select-quote.openMenu' || mod.SELECTION_MENU_COMMAND_ID !== menu.id) {
    problems.push(`menu command id is "${menu.id}"`)
  }
  if (add.id !== 'select-quote.addToTask' || mod.ADD_TO_TASK_COMMAND_ID !== add.id) {
    problems.push(`add command id is "${add.id}"`)
  }

  const expected = {
    menu: {
      'desktop:macos': ['KeyL', ['primary']],
      'desktop:windows': ['KeyL', ['primary', 'shift']],
      'desktop:linux': ['KeyL', ['primary', 'shift']],
      'web:macos': ['KeyL', ['primary', 'shift']],
      'web:windows': ['KeyL', ['primary', 'shift']],
      'web:linux': ['Comma', ['primary', 'shift']],
    },
    add: {
      'desktop:macos': ['KeyL', ['primary', 'shift']],
      'desktop:windows': ['Period', ['primary', 'shift']],
      'desktop:linux': ['Period', ['primary', 'shift']],
      'web:macos': ['KeyL', ['primary', 'alt']],
      'web:windows': ['Period', ['primary', 'shift']],
      'web:linux': ['Period', ['primary', 'shift']],
    },
  }
  for (const [kind, command] of [['menu', menu], ['add', add]]) {
    const want = expected[kind]
    const gotProfiles = Object.keys(command.defaults).sort()
    const wantProfiles = Object.keys(want).sort()
    if (JSON.stringify(gotProfiles) !== JSON.stringify(wantProfiles)) {
      problems.push(`${kind} defaults are [${gotProfiles.join(', ')}], want [${wantProfiles.join(', ')}]`)
    }
    for (const [profile, [code, modifiers]] of Object.entries(want)) {
      const binding = command.defaults[profile]
      if (binding?.code !== code) {
        problems.push(`${kind} ${profile} default is ${JSON.stringify(binding?.code)}, want ${code}`)
        continue
      }
      if (JSON.stringify([...binding.modifiers]) !== JSON.stringify(modifiers)) {
        problems.push(
          `${kind} ${profile} modifiers are [${binding.modifiers.join(', ')}], want [${modifiers.join(', ')}]`,
        )
      }
    }
    if (JSON.stringify(command.regions) !== JSON.stringify(['page']) || command.modals.length !== 0) {
      problems.push(`${kind} command is not scoped to page/no-modal input`)
    }
    if (typeof command.label() !== 'string' || command.label() === '') {
      problems.push(`${kind} command has no label for the shortcut reference`)
    }
  }
  // Web Linux admits only three combinations; KeyL there would throw on
  // registration. The Host owns primary+Slash, so both commands use the other
  // two (and must not collide with each other on any profile).
  for (const [kind, command] of [['menu', menu], ['add', add]]) {
    const linux = command.defaults['web:linux']
    if (linux && !['Comma', 'Period'].includes(linux.code)) {
      problems.push(`${kind} web:linux default ${linux.code} is not Web-admissible`)
    }
  }
  for (const profile of Object.keys(expected.menu)) {
    const left = menu.defaults[profile]
    const right = add.defaults[profile]
    if (
      left &&
      right &&
      left.code === right.code &&
      JSON.stringify([...left.modifiers].sort()) === JSON.stringify([...right.modifiers].sort())
    ) {
      problems.push(`menu and add share the ${profile} binding`)
    }
  }

  const context = { region: 'page', modal: null }
  const blocked = menu.resolve(context)
  if (blocked.status !== 'blocked' || blocked.reason !== 'menu.noSelection') {
    problems.push(`without a live toolbar the menu command resolved ${JSON.stringify(blocked)}`)
  }
  if (add.resolve(context).status !== 'blocked') {
    problems.push('the add command ran without a live toolbar')
  }

  let opened = 0
  let added = 0
  runtime.selection = {
    state: () => 'busy',
    open: () => {
      opened += 1
    },
    add: () => {
      added += 1
    },
  }
  const busyMenu = menu.resolve(context)
  if (busyMenu.status !== 'blocked' || busyMenu.reason !== 'menu.busy') {
    problems.push(`an open comment step resolved ${JSON.stringify(busyMenu)}`)
  }
  if (add.resolve(context).status !== 'blocked') {
    problems.push('the add command ran while the comment step was open')
  }

  runtime.selection = {
    state: () => 'ready',
    open: () => {
      opened += 1
    },
    add: () => {
      added += 1
    },
  }
  const handledMenu = menu.resolve(context)
  if (handledMenu.status !== 'handled') {
    problems.push(`with a live selection the menu command resolved ${handledMenu.status}`)
  } else {
    handledMenu.run()
    if (opened !== 1) problems.push(`the menu command opened the menu ${opened} times, want 1`)
  }
  const handledAdd = add.resolve(context)
  if (handledAdd.status !== 'handled') {
    problems.push(`with a live selection the add command resolved ${handledAdd.status}`)
  } else {
    handledAdd.run()
    if (added !== 1) problems.push(`the add command added ${added} times, want 1`)
  }

  runtime.selection = {
    state: () => 'no-selection',
    open: () => {
      opened += 1
    },
    add: () => {
      added += 1
    },
  }
  if (menu.resolve(context).status !== 'blocked' || add.resolve(context).status !== 'blocked') {
    problems.push('a bridge without a readable selection still ran a command')
  }
  delete runtime.selection
  return problems
}

/** A Host shortcut-service stand-in: registration, disposal, one catalog. */
function fakeShortcuts(record) {
  const commands = new Map()
  const listeners = new Set()
  const state = { registered: [], disposed: 0 }
  const snapshot = () =>
    [...commands.values()].map((command) => ({
      id: command.id,
      label: command.label(),
      keys: [],
      issue: null,
      conflicts: [],
    }))
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  return {
    service: {
      register(command) {
        if (commands.has(command.id)) {
          throw new Error(`Duplicate shortcut command: ${command.id}`)
        }
        commands.set(command.id, command)
        state.registered.push(command)
        record?.push({ kind: 'shortcuts.register', label: command.id })
        notify()
        return () => {
          commands.delete(command.id)
          state.disposed += 1
          record?.push({ kind: 'shortcuts.dispose', label: command.id })
          notify()
        }
      },
      catalog: {
        getSnapshot: snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
    },
    state,
    active: () => [...commands.keys()],
  }
}

/**
 * The settings page must ride the config store, not a copy of it.
 *
 * `attachConfigForm` is the join point: initial publish, live updates, and a
 * reset to defaults when the service goes away. The toolbars read
 * `resolveTriggers` at event time, so this store is the whole authority.
 */
async function checkConfigStore() {
  const problems = []
  const cfg = await import(new URL('../src/client/config.ts', import.meta.url).href)
  const { DEFAULT_CONFIG, getConfig, normalizeConfig, publishConfig, resolveTriggers, subscribeConfig } = cfg

  if (getConfig().triggerMode !== 'auto' || getConfig().shortcut !== false) {
    problems.push('config store does not start on the defaults')
  }
  const invalid = normalizeConfig({ triggerMode: 'nope', shortcut: 'yes' })
  if (invalid.triggerMode !== 'auto' || invalid.shortcut !== false) {
    problems.push(`invalid config normalized to ${JSON.stringify(invalid)}, want defaults`)
  }
  for (const [input, want] of [
    [{ triggerMode: 'auto' }, { auto: true, contextMenu: false, shortcut: false }],
    [{ triggerMode: 'contextmenu' }, { auto: false, contextMenu: true, shortcut: false }],
    [{ triggerMode: 'both' }, { auto: true, contextMenu: true, shortcut: false }],
    [{ triggerMode: 'both', shortcut: true }, { auto: true, contextMenu: true, shortcut: true }],
  ]) {
    const plan = resolveTriggers(normalizeConfig(input))
    if (JSON.stringify(plan) !== JSON.stringify(want)) {
      problems.push(`resolveTriggers(${JSON.stringify(input)}) -> ${JSON.stringify(plan)}`)
    }
  }

  let notifications = 0
  const off = subscribeConfig(() => {
    notifications += 1
  })
  publishConfig({ triggerMode: 'both', shortcut: true })
  if (getConfig().triggerMode !== 'both' || getConfig().shortcut !== true) {
    problems.push('publishConfig did not surface the new value')
  }
  const afterFirst = notifications
  publishConfig({ triggerMode: 'both', shortcut: true })
  if (notifications !== afterFirst) {
    problems.push('an identical config republished notified listeners')
  }

  let value = { triggerMode: 'contextmenu', shortcut: false }
  const listeners = new Set()
  const form = {
    getSnapshot: () => ({ status: 'ready', value }),
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  const detach = cfg.attachConfigForm(form)
  if (getConfig().triggerMode !== 'contextmenu' || getConfig().shortcut !== false) {
    problems.push('attachConfigForm did not publish the form snapshot')
  }
  value = { triggerMode: 'auto', shortcut: true }
  for (const fn of [...listeners]) fn()
  if (getConfig().triggerMode !== 'auto' || getConfig().shortcut !== true) {
    problems.push('a config-form update did not reach the store')
  }
  detach()
  if (getConfig().triggerMode !== DEFAULT_CONFIG.triggerMode || getConfig().shortcut !== DEFAULT_CONFIG.shortcut) {
    problems.push('detaching the config form did not restore the defaults')
  }
  off()
  publishConfig(undefined)
  return problems
}

/** Host Config and the client defaults must describe the same fields. */
async function checkHostConfig() {
  const problems = []
  const cfg = await import(new URL('../src/client/config.ts', import.meta.url).href)
  const host = await import(pathToFileURL(resolve(root, 'lib/index.js')).href)
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

  if (host.name !== manifest.name) {
    problems.push(`host entry exports name "${host.name}", package is "${manifest.name}"`)
  }
  if (typeof host.apply !== 'function') problems.push('host entry exports no apply()')
  if (typeof host.Config !== 'function' || typeof host.Config.toJSON !== 'function') {
    problems.push('host entry exports no schemastery Config — the settings schema would be empty')
    return problems
  }

  const schema = host.Config.toJSON()
  // `toJSON()` is a ref graph; the root (Config's uid) carries the field dict.
  const rootNode = schema.refs?.[schema.uid]
  const want = Object.keys(cfg.DEFAULT_CONFIG).sort()
  const got = Object.keys(rootNode?.dict ?? {}).sort()
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    problems.push(`host Config fields [${got.join(', ')}] drift from client defaults [${want.join(', ')}]`)
  }
  const parsed = host.Config({})
  for (const field of want) {
    const ref = parsed[field]
    if (ref === undefined || typeof ref.get !== 'function') {
      problems.push(`host Config field "${field}" is not a volatile ref`)
      continue
    }
    if (ref.get() !== cfg.DEFAULT_CONFIG[field]) {
      problems.push(`host default ${field}=${JSON.stringify(ref.get())} differs from client default ${JSON.stringify(cfg.DEFAULT_CONFIG[field])}`)
    }
    const node = schema.refs?.[rootNode?.dict?.[field]]
    if (node?.meta?.volatile !== true) {
      problems.push(`host Config field "${field}" is not .volatile() — it never reaches the settings mirror`)
    }
  }
  let rejected = false
  try {
    host.Config({ triggerMode: 'nope' })
  } catch {
    rejected = true
  }
  if (!rejected) problems.push('host Config accepted an unknown triggerMode')

  const inject = manifest.dsh?.client?.inject ?? []
  for (const spec of [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-shortcuts',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-ui-plugin-manager',
    '@deepseek-ai/dsh-api-remotes',
  ]) {
    if (!inject.includes(spec)) {
      problems.push(`dsh.client.inject lacks "${spec}" — the settings/shortcut surface may load without its services`)
    }
  }
  return problems
}

/** The settings page and config binding must survive as built, not just in source. */
function checkConfigWiring(code) {
  const problems = []
  if (!/configForms\.get\((?:["']select-quote["']|ROW_ID)\)/.test(code)) {
    problems.push('built client does not read configForms.get(ROW_ID) — settings would never reach the toolbar')
  }
  if (!/configForms\.whileServed\(\[(?:["']select-quote["']|ROW_ID)\]/.test(code)) {
    problems.push('built client registers the settings page without whileServed')
  }
  if (!/name:\s*["']plugins\.bundle\.config["']/.test(code)) {
    problems.push(
      'built client has no plugins.bundle.config registration — the bundle page has no settings section',
    )
  }
  if (
    !/name:\s*["']plugins\.bundle\.config["'][\s\S]{0,200}locale:\s*LOCALE_NS/.test(code)
  ) {
    problems.push('the settings section is registered without its locale seat')
  }
  // The toolbar side is chosen from the live config each time a selection is
  // read, so a change applies without a reload.
  if (!code.includes('toolbarPlacement')) {
    problems.push('built client never reads toolbarPlacement — the position setting would be inert')
  }
  if (!code.includes('dsq-toolbar-placement')) {
    problems.push('the settings page has no toolbar-position control')
  }
  for (const token of [
    '--dsw-alias-brand-primary',
    '--dsw-alias-border-l3',
    '--dsw-alias-switch-thumb',
    '--dsw-alias-label-primary-foreground',
  ]) {
    if (!code.includes(token)) {
      problems.push(`the settings switch no longer uses the Host token ${token}`)
    }
  }
  // The Host switch opts into a true pill explicitly; without corner-shape the
  // product's superellipse default leaves visibly softer corners.
  const switchRule = code.match(/\.dsq_switch \{[\s\S]*?\}/)?.[0] ?? ''
  if (!switchRule.includes('border-radius: 999px') || !switchRule.includes('corner-shape: round')) {
    problems.push('the settings switch is not the Host full-round pill (999px + corner-shape: round)')
  }
  return problems
}

/** The menu trigger, surface, and Host command must survive into the bundle. */
function checkMenuWiring(code) {
  const problems = []
  if (!/addEventListener\(["']contextmenu["']/.test(code)) {
    problems.push('built client never listens for contextmenu — right-click mode does nothing')
  }
  if (!code.includes('shouldOpenSelectionMenu') || !code.includes('defaultPrevented')) {
    problems.push('built client does not gate right-click ownership — it could fight other menus')
  }
  if (!code.includes('data-dsq-menu') || !code.includes('dsq_ctxMenu')) {
    problems.push('built client has no selection menu surface')
  }
  if (!/shortcuts\.register\(/.test(code)) {
    problems.push('built client never registers a shortcut command')
  }
  for (const id of ['select-quote.openMenu', 'select-quote.addToTask']) {
    if (!code.includes(id)) problems.push(`built client never registers ${id}`)
  }
  // The settings page shows the effective keycaps, not a static copy of the
  // defaults; that surface must follow the Host catalog.
  if (!code.includes('.catalog')) {
    problems.push('built client never reads the Host shortcut catalog')
  }
  return problems
}

/** One row id in the identity module, both patches, and package.json. */
async function checkPatchIdentity() {
  const problems = []
  const identity = await import(new URL('../src/shared/identity.ts', import.meta.url).href)
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  if (identity.PACKAGE_NAME !== manifest.name) {
    problems.push(`identity PACKAGE_NAME "${identity.PACKAGE_NAME}" != package name "${manifest.name}"`)
  }
  for (const file of ['cordis.patch.yml', 'dev.patch.example.yml']) {
    let text
    try {
      text = readFileSync(resolve(root, file), 'utf8')
    } catch {
      problems.push(`${file} is missing — the Loader row has no declared id`)
      continue
    }
    const ids = [...text.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map((match) => match[1])
    if (!ids.includes(identity.ROW_ID)) {
      problems.push(`${file} row id [${ids.join(', ')}] does not include "${identity.ROW_ID}"`)
    }
  }
  return problems
}

const code = readFileSync(resolve(root, 'lib/client.js'), 'utf8')
const bundle = loadFactory(code, storage)
console.log(`bundle id: ${bundle.id}`)

/** Fresh module state for one `apply()` run (the bundle's store is module-level). */
const loadModule = () =>
  bundle.factory((name) => {
    if (!SEEDS.has(name)) throw new Error(`require("${name}") is not a platform seed word`)
    return require(name)
  })

const module = loadModule()

// The Host services `select-quote` and shows the config page only while it is
// in the describe mirror. The fake form stands in for that service; the fake
// shortcut registry records the command lifecycle.
const record = []
const configFixture = fakeConfigForms({ triggerMode: 'auto', shortcut: false })
const shortcutsFixture = fakeShortcuts(record)
const { ctx, dicts } = mockContext(record, {
  configForms: configFixture.service,
  shortcuts: shortcutsFixture.service,
})
const outcome = module.apply(ctx)
if (outcome !== undefined) throw new Error('apply() must not return a value')

const configFixtureProblems = []
if (configFixture.subscriberCount() !== 1) {
  configFixtureProblems.push(
    `the client holds ${configFixture.subscriberCount()} config subscriptions, want 1`,
  )
}

// The bundle config page gets no `form` prop from the Host; the entry must
// inject the live row controller itself.
const bundleFormProblems = []
const bundleEntry = record.find(
  (entry) =>
    entry.kind === 'slots.register' &&
    entry.label === 'plugins.bundle.config / dsh-select-quote',
)
if (bundleEntry === undefined) {
  bundleFormProblems.push('the bundle settings section was never registered')
} else if (typeof bundleEntry.options?.inject !== 'function') {
  bundleFormProblems.push('the bundle settings section does not inject a form controller')
} else {
  const injected = bundleEntry.options.inject()
  if (injected?.form !== configFixture.service.get('select-quote')) {
    bundleFormProblems.push('the bundle settings section injected a form other than the row form')
  }
  for (const method of ['getSnapshot', 'subscribe', 'set']) {
    if (typeof injected?.form?.[method] !== 'function') {
      bundleFormProblems.push(`the injected form controller has no ${method}()`)
    }
  }
}

// The shortcut setting is a live switch on the Host registry, covering both
// commands (menu and add-to-task) together.
const shortcutProblems = []
const WANT_COMMANDS = ['select-quote.openMenu', 'select-quote.addToTask']
if (shortcutsFixture.active().length !== 0) {
  shortcutProblems.push('a shortcut command was registered while the setting is off')
}
// A live write must not throw on its way through the subscribed store.
configFixture.set({ triggerMode: 'contextmenu', shortcut: true })
const activeShortcuts = shortcutsFixture.active()
if (JSON.stringify(activeShortcuts) !== JSON.stringify(WANT_COMMANDS)) {
  shortcutProblems.push(
    `enabling the shortcut registered [${activeShortcuts.join(', ')}], want [${WANT_COMMANDS.join(', ')}]`,
  )
}
configFixture.set({ triggerMode: 'both', shortcut: false })
if (shortcutsFixture.active().length !== 0) {
  shortcutProblems.push('turning the shortcut off left a command registered')
}
if (shortcutsFixture.state.disposed !== 2) {
  shortcutProblems.push(
    `turning the shortcut off disposed ${shortcutsFixture.state.disposed} commands, want 2`,
  )
}
configFixture.set({ triggerMode: 'both', shortcut: true })
if (
  JSON.stringify(shortcutsFixture.active()) !== JSON.stringify(WANT_COMMANDS) ||
  shortcutsFixture.state.registered.length !== 4
) {
  shortcutProblems.push(
    `re-enabling the shortcut left registrations at ${shortcutsFixture.state.registered.length}, active [${shortcutsFixture.active().join(', ')}]`,
  )
}

// Missing configForms must not block activation or leave a dead settings page.
const degradeRecord = []
const { ctx: degradeCtx } = mockContext(degradeRecord)
const degradeModule = loadModule()
const degradeOutcome = degradeModule.apply(degradeCtx)
if (degradeOutcome !== undefined) throw new Error('apply() must not return a value')
const degradeProblems = []
if (
  degradeRecord.some(
    (entry) => entry.kind === 'slots.register' && entry.label.startsWith('plugins.bundle.config /'),
  )
) {
  degradeProblems.push('a settings section was registered although no config form is served')
}
if (degradeRecord.filter((entry) => entry.kind === 'slots.register').length !== 5) {
  degradeProblems.push(
    `without configForms the client registered ${degradeRecord.filter((entry) => entry.kind === 'slots.register').length} slots, want the 5 core ones`,
  )
}
if (!degradeRecord.some((entry) => entry.kind === 'inject' && entry.label === 'configForms')) {
  degradeProblems.push('the config service is not an optional nested injection')
}
if (!degradeRecord.some((entry) => entry.kind === 'inject' && entry.label === 'shortcuts')) {
  degradeProblems.push('the shortcut service is not an optional nested injection')
}
if (degradeRecord.some((entry) => entry.kind === 'shortcuts.register')) {
  degradeProblems.push('a shortcut was registered although no shortcut service is served')
}

// dsh 0.2.2-alpha.2 already ships every language pack, and `addLanguage`
// throws on a duplicate id — which fails the whole fiber and blocks the GUI.
// On that catalog the plugin must only add its dictionaries.
const hostCatalogRecord = []
const { ctx: hostCatalogCtx } = mockContext(hostCatalogRecord, {
  hostLocales: ['zh', 'en', ...HOST_LANGUAGE_PACKS],
})
loadModule().apply(hostCatalogCtx)
const hostCatalogProblems = []
const readdedLanguages = hostCatalogRecord.filter((entry) => entry.kind === 'locale.language')
if (readdedLanguages.length > 0) {
  hostCatalogProblems.push(
    `the Host already ships [${HOST_LANGUAGE_PACKS.join(', ')}], yet the plugin re-added [${readdedLanguages
      .map((entry) => entry.label)
      .join(', ')}]`,
  )
}
const hostRegistrations = hostCatalogRecord.filter((entry) => entry.kind === 'locale.register')
const wantRegistrations = 1 + HOST_LANGUAGE_PACKS.length
if (hostRegistrations.length !== wantRegistrations) {
  hostCatalogProblems.push(
    `a host-shipped catalog got ${hostRegistrations.length} dictionary registrations, want ${wantRegistrations}`,
  )
}

const missing = EXPECTED.filter(
  (expected) => !record.some((entry) => entry.kind === expected.kind && entry.label === expected.label),
)
const broken = record.filter((entry) => entry.kind === 'slots.register' && typeof entry.component !== 'function')
const dictionaryProblems = checkDictionaries(dicts)
const datasetProblems = checkDatasetKeys(code)
const observerProblems = checkDirectiveObserver(code)
const configWiringProblems = checkConfigWiring(code)
const configStoreProblems = await checkConfigStore()
const menuWiringProblems = checkMenuWiring(code)
const menuTriggerProblems = await checkMenuTrigger()
const shortcutCommandProblems = await checkShortcutCommands()
const hostConfigProblems = await checkHostConfig()
const patchIdentityProblems = await checkPatchIdentity()

for (const entry of record) console.log(`  ${entry.kind.padEnd(16)} ${entry.label}`)

const languages = new Set()
for (const perLocale of dicts.values()) for (const locale of perLocale.keys()) languages.add(locale)

const persistenceProblems = await checkPersistence()
const linkProblems = await checkSelectionUrl()
const metaProblems = checkPackageMeta()
const userChromeProblems = [...checkUserChrome(code), ...(await checkHostNode())]
const sendKeyProblems = await checkSendKey()
const composedDraftProblems = await checkComposedDraft()
const rewindProblems = checkRewindRestore(code)
const surfaceProblems = [...checkTranscriptSurfaces(code), ...(await checkEchoStrip())]

for (const entry of record) console.log(`  ${entry.kind.padEnd(16)} ${entry.label}`)

if (
  missing.length > 0 ||
  broken.length > 0 ||
  dictionaryProblems.length > 0 ||
  datasetProblems.length > 0 ||
  observerProblems.length > 0 ||
  persistenceProblems.length > 0 ||
  linkProblems.length > 0 ||
  metaProblems.length > 0 ||
  userChromeProblems.length > 0 ||
  sendKeyProblems.length > 0 ||
  composedDraftProblems.length > 0 ||
  rewindProblems.length > 0 ||
  configFixtureProblems.length > 0 ||
  bundleFormProblems.length > 0 ||
  degradeProblems.length > 0 ||
  hostCatalogProblems.length > 0 ||
  configWiringProblems.length > 0 ||
  configStoreProblems.length > 0 ||
  menuWiringProblems.length > 0 ||
  menuTriggerProblems.length > 0 ||
  shortcutCommandProblems.length > 0 ||
  shortcutProblems.length > 0 ||
  hostConfigProblems.length > 0 ||
  patchIdentityProblems.length > 0 ||
  surfaceProblems.length > 0
) {
  for (const entry of missing) console.error(`MISSING: ${entry.kind} ${entry.label}`)
  for (const entry of broken) console.error(`NOT A COMPONENT: ${entry.label}`)
  for (const problem of dictionaryProblems) console.error(`DICTIONARY: ${problem}`)
  for (const problem of datasetProblems) console.error(`DATASET KEY: ${problem}`)
  for (const problem of observerProblems) console.error(`DIRECTIVE OBSERVER: ${problem}`)
  for (const problem of persistenceProblems) console.error(`PERSISTENCE: ${problem}`)
  for (const problem of linkProblems) console.error(`LINK: ${problem}`)
  for (const problem of metaProblems) console.error(`PACKAGE META: ${problem}`)
  for (const problem of userChromeProblems) console.error(`USER CHROME: ${problem}`)
  for (const problem of sendKeyProblems) console.error(`SEND KEY: ${problem}`)
  for (const problem of composedDraftProblems) console.error(`COMPOSED DRAFT: ${problem}`)
  for (const problem of rewindProblems) console.error(`REWIND RESTORE: ${problem}`)
  for (const problem of configFixtureProblems) console.error(`CONFIG FIXTURE: ${problem}`)
  for (const problem of bundleFormProblems) console.error(`BUNDLE FORM: ${problem}`)
  for (const problem of degradeProblems) console.error(`CONFIG FALLBACK: ${problem}`)
  for (const problem of hostCatalogProblems) console.error(`HOST LOCALE CATALOG: ${problem}`)
  for (const problem of configWiringProblems) console.error(`CONFIG WIRING: ${problem}`)
  for (const problem of configStoreProblems) console.error(`CONFIG STORE: ${problem}`)
  for (const problem of menuWiringProblems) console.error(`MENU WIRING: ${problem}`)
  for (const problem of menuTriggerProblems) console.error(`MENU TRIGGER: ${problem}`)
  for (const problem of shortcutCommandProblems) console.error(`SHORTCUT COMMAND: ${problem}`)
  for (const problem of shortcutProblems) console.error(`SHORTCUT SWITCH: ${problem}`)
  for (const problem of hostConfigProblems) console.error(`HOST CONFIG: ${problem}`)
  for (const problem of patchIdentityProblems) console.error(`ROW IDENTITY: ${problem}`)
  for (const problem of surfaceProblems) console.error(`TRANSCRIPT SURFACE: ${problem}`)
  process.exit(1)
}
console.log(
  `ok: ${EXPECTED.length} contributions registered, ${module.inject.join(', ')} injected, ` +
    `copy complete for ${[...languages].sort().join('/')}, annotation persistence + cross-tab sync replayed, link detection replayed, ` +
    `host view resolution replayed, send gestures replayed, composed annotation blocks read back, ` +
    `echo strip replayed, transcript summary single-block, mark preview wired, ` +
    `host config + bundle settings section wired (defaults, live update, invalid-value fallback, no-service fallback), ` +
    `right-click ownership + shortcut commands replayed (two actions, defaults, selection gating, live registration, catalog mirror), ` +
    `package metadata (locale + icon) resolved and packed`,
)
