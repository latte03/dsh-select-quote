/**
 * Mirror-split regression, run in real Chromium by `pnpm run verify:mirror`.
 *
 * The decorator's contract is with React's reconciler and the real DOM, so it is
 * asserted against real React 18 rather than jsdom: streaming chunks, inline
 * markup appearing mid-paragraph, orphan cleanup, the deferred `<code>` form,
 * and a host module reload over a live document.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { watchAnnotationDirectives } from '../../src/client/dom/decorateAnnotationDirectives.ts'
import { ensureToolbarStyles } from '../../src/client/styles.ts'

const D = (i: number): string => `:dsh-annotation{index="${i}"}`
const CHIP = '[data-dsq-ann-directive]'

interface Result { name: string; ok: boolean; detail: string }
const results: Result[] = []
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
}

const mount = document.createElement('div')
document.body.appendChild(mount)
ensureToolbarStyles()
const root = createRoot(mount)
const dispose = watchAnnotationDirectives(document.body)

const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0))

/**
 * Faithful to the host: AssistantMarkdown root carries data-streaming, the body
 * holds an array of blocks separated by "\n", and a paragraph is
 * `jsx("p", { children: [...] })` — children is ALWAYS an array, even with one
 * item, which is what makes React build a HostText fiber instead of calling
 * setTextContent on the element.
 */
function render(blocks: unknown[], streaming: boolean): void {
  const body: unknown[] = []
  for (const b of blocks) {
    if (body.length > 0) body.push('\n')
    body.push(b)
  }
  flushSync(() => {
    root.render(
      createElement('div', { 'data-streaming': streaming || undefined },
        createElement('div', { children: body })),
    )
  })
}

const para = (key: number, inline: unknown[]): unknown =>
  createElement('p', { key, children: inline })

const codeSpan = (key: number, text: string): unknown =>
  createElement('code', { key, children: text })

/** Prose of an element with the plugin's own chips excluded. */
function prose(el: Element): string {
  let out = ''
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest(CHIP)) continue
    out += node.nodeValue ?? ''
  }
  return out
}

const p = (): HTMLElement => mount.querySelector('p') as HTMLElement
const chips = (): NodeListOf<Element> => mount.querySelectorAll(CHIP)

async function streamingProse(): Promise<void> {
  const chunks = ['alpha ', `alpha ${D(1)}`, `alpha ${D(1)} beta`, `alpha ${D(1)} beta gamma`]
  let hostNode: Node | null = null
  let chip: Element | null = null
  for (const [i, text] of chunks.entries()) {
    render([para(0, [text])], true)
    await tick()
    const first = p().firstChild
    check(`S1.${i} host text node still first and connected`,
      first instanceof Text && first.isConnected, String(first?.nodeName))
    if (hostNode === null) hostNode = first
    else check(`S1.${i} React kept the same text node`, first === hostNode)
    const expected = text.split(D(1)).join('')
    check(`S1.${i} no prose lost`, prose(p()) === expected, `${JSON.stringify(prose(p()))} want ${JSON.stringify(expected)}`)
    const want = text.includes(D(1)) ? 1 : 0
    check(`S1.${i} chip count`, chips().length === want, String(chips().length))
    if (want === 1) {
      if (chip === null) chip = chips()[0]
      else check(`S2.${i} chip identity stable across chunks`, chips()[0] === chip)
      check(`S1.${i} prefix kept in host node`, (first as Text).nodeValue === 'alpha ',
        JSON.stringify((first as Text).nodeValue))
    }
  }
  // Stream end: the host swaps the streaming renderer for a full re-parse, so
  // every element object is new even though the text is identical.
  render([para(0, [`alpha ${D(1)} beta gamma`])], false)
  await tick()
  check('S6 prose intact after stream-end re-parse', prose(p()) === 'alpha  beta gamma', JSON.stringify(prose(p())))
  check('S6 exactly one chip after re-parse', chips().length === 1, String(chips().length))
}

/**
 * A burst of stream deltas can commit twice in one task, and the final chunk
 * may share its task with the stream-end attribute removal. Every characterData
 * record of that batch is superseded by the node's final value; planning once
 * per callback keeps a stale record from consuming the one-shot self-write
 * flag, which would retire the mirror and drop the tail for the rest of the
 * task (permanently if that was the last chunk).
 */
async function batchedCommits(): Promise<void> {
  await settle()
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  check('S17 precondition chip present', chips().length === 1, String(chips().length))
  render([para(0, [`alpha ${D(1)} beta gamma`])], true)
  render([para(0, [`alpha ${D(1)} beta gamma delta`])], true)
  await tick()
  check('S17 batched chunks keep the reading order',
    transcript(p()) === expected(`alpha ${D(1)} beta gamma delta`), JSON.stringify(transcript(p())))
  check('S17 batched chunks keep one chip', chips().length === 1, String(chips().length))
  check('S17 batched chunks keep the mirror', p().querySelector('[data-dsq-ann-mirror]') !== null)
  // Final chunk and `data-streaming` removal committed in one task.
  const last = `alpha ${D(1)} beta gamma delta final`
  render([para(0, [`alpha ${D(1)} beta gamma delta`])], true)
  render([para(0, [last])], false)
  await tick()
  check('S17 batched stream end keeps the reading order',
    transcript(p()) === expected(last), JSON.stringify(transcript(p())))
  check('S17 batched stream end keeps one chip', chips().length === 1, String(chips().length))
}

async function orphanCleanup(): Promise<void> {
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  check('S3 precondition chip present', chips().length === 1)
  // A new inline node appears: React deletes the old Text fiber at index 0 and
  // mounts <strong> there. Our mirrors must go with their host node.
  render([para(0, [createElement('strong', { key: 0, children: 'bold' }), ' tail'])], true)
  await tick()
  check('S3 no orphan chip', chips().length === 0, String(chips().length))
  check('S3 no duplicate prose', prose(p()) === 'bold tail', JSON.stringify(prose(p())))
}

async function inlineCode(): Promise<void> {
  const raw = D(1)
  let codeEl: Element | null = null
  for (let i = 0; i < 3; i++) {
    render([para(0, [codeSpan(0, raw)])], true)
    await tick()
    const code = mount.querySelector('code')
    check(`S4.${i} code element survives streaming`, code !== null && code.textContent === raw,
      JSON.stringify(code?.textContent))
    if (codeEl === null) codeEl = code
    else check(`S4.${i} code element identity stable`, code === codeEl)
    check(`S4.${i} code form deferred while streaming`, chips().length === 0, String(chips().length))
  }
  render([para(0, [codeSpan(0, raw)])], false)
  await tick()
  check('S5 code form chips once the stream ends', chips().length === 1, String(chips().length))
  const code = mount.querySelector('code')
  check('S5 host code element kept for React to remove', code !== null)
  check('S5 code element emptied and hidden',
    code?.textContent === '' && code?.classList.contains('dsq_annCodeHost'),
    `${JSON.stringify(code?.textContent)} ${code?.className}`)
  check('S5 hidden rule reaches the sheet',
    code !== null && getComputedStyle(code).display === 'none',
    code === null ? 'no code' : getComputedStyle(code).display)
  // React writes the directive back (a re-render): must not grow a second chip.
  render([para(0, [codeSpan(0, raw)])], false)
  await tick()
  check('S5 re-render does not duplicate the chip', chips().length === 1, String(chips().length))
  // Deleting the paragraph is what used to throw NotFoundError.
  render([para(0, ['plain'])], false)
  await tick()
  check('S5 paragraph deletion after code chip survives', chips().length === 0, String(chips().length))
}

async function multipleDirectives(): Promise<void> {
  const text = `a ${D(1)} b ${D(3)} c`
  render([para(0, [text])], true)
  await tick()
  check('S7 two chips', chips().length === 2, String(chips().length))
  check('S7 prose intact', prose(p()) === 'a  b  c', JSON.stringify(prose(p())))
  const indices = [...chips()].map(c => (c as HTMLElement).dataset.dsqAnnDirective)
  check('S7 chip order', indices.join(',') === '1,3', indices.join(','))
  // Adjacent directives must not produce an empty text sibling.
  render([para(0, [`${D(1)}${D(2)}`])], true)
  await tick()
  check('S7 adjacent directives', chips().length === 2, String(chips().length))
  const box = p().querySelector('[data-dsq-ann-mirror]')
  check('S7 no empty mirror text',
    box !== null && [...box.childNodes].every(n => !(n instanceof Text) || n.nodeValue !== ''),
    JSON.stringify([...(box?.childNodes ?? [])].map(n => n.nodeName)))
  // The model rewrote the paragraph: fewer directives, different prose.
  render([para(0, [`only ${D(2)} left`])], true)
  await tick()
  check('S7 stale chip retired', chips().length === 1, String(chips().length))
  check('S7 prose after rewrite', prose(p()) === 'only  left', JSON.stringify(prose(p())))
}

/**
 * Host-shaped inline children: `Kn = e.map((r, i) => Zp(r, i, ctx))` keys every
 * node by INDEX and returns raw strings for text, so text fibers carry implicit
 * index keys and can never be "moved" by a key change.
 */
function inline(text: string): unknown[] {
  const out: unknown[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[1] !== undefined) out.push(createElement('strong', { key, children: [m[1]] }))
    else if (m[2] !== undefined) out.push(createElement('code', { key, children: m[2] }))
    else out.push(createElement('a', { key, href: m[4], children: [m[3]] }))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** What the paragraph should read as, with markdown markers and chips resolved. */
function expected(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/:dsh-annotation\{index="(\d+)"\}/g, '[[$1]]')
}

/** DOM-order reading of a paragraph, chips included as [[N]]. */
function transcript(el: Element): string {
  let out = ''
  const walk = (n: Node): void => {
    if (n instanceof Text) { out += n.nodeValue ?? ''; return }
    if (!(n instanceof Element)) return
    if (n.matches(CHIP)) { out += `[[${(n as HTMLElement).dataset.dsqAnnDirective}]]`; return }
    for (const c of n.childNodes) walk(c)
  }
  for (const c of el.childNodes) walk(c)
  return out
}

async function settle(): Promise<void> {
  render([para(0, ['reset'])], true)
  await tick()
}

/**
 * Point 3: a directive-bearing paragraph that grows bold / link / inline code
 * mid-stream. React appends the new inline fibers AFTER our mirror box (it does
 * not know the box exists), so the reading order is the thing to assert.
 */
async function inlineGrowth(): Promise<void> {
  const cases: [string, string[]][] = [
    ['S9 bold after the directive', [
      `alpha ${D(1)} beta`,
      `alpha ${D(1)} beta **bold** tail`,
      `alpha ${D(1)} beta **bold** tail more`,
    ]],
    ['S10 bold before the directive', [
      `alpha ${D(1)} beta`,
      `**bold** alpha ${D(1)} beta`,
      `**bold** alpha ${D(1)} beta tail`,
    ]],
    ['S10b bold between prose and directive', [
      `alpha ${D(1)} beta`,
      `alpha **bold** ${D(1)} beta`,
    ]],
    ['S11 link after the directive', [
      `alpha ${D(1)} beta`,
      `alpha ${D(1)} beta [x](https://example.com) tail`,
    ]],
    ['S12 inline code beside a prose directive', [
      `alpha ${D(1)} beta`,
      `alpha ${D(1)} beta \`code\` tail`,
    ]],
    ['S12b two directives split by new bold', [
      `a ${D(1)} b ${D(2)} c`,
      `a ${D(1)} b **bold** ${D(2)} c`,
    ]],
  ]
  for (const [name, chunks] of cases) {
    await settle()
    for (const [i, text] of chunks.entries()) {
      render([para(0, inline(text))], true)
      await tick()
      const want = expected(text)
      check(`${name} chunk ${i} reading order`, transcript(p()) === want,
        `${JSON.stringify(transcript(p()))} want ${JSON.stringify(want)}`)
      const wantChips = (text.match(/:dsh-annotation\{/g) ?? []).length
      check(`${name} chunk ${i} chip count`, chips().length === wantChips,
        `${chips().length} want ${wantChips}`)
    }
    // Stream end: full re-parse, every element object new.
    const last = chunks[chunks.length - 1]
    render([para(0, inline(last))], false)
    await tick()
    check(`${name} after stream end`, transcript(p()) === expected(last),
      `${JSON.stringify(transcript(p()))} want ${JSON.stringify(expected(last))}`)
  }
}

/**
 * Point 2: React rewrote the node to exactly the old prefix (the directive was
 * regenerated away, the prose before it unchanged). The idempotence guard must
 * not mistake that for our own truncation write and keep a stale mirror.
 */
async function prefixRewrite(): Promise<void> {
  await settle()
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  check('S13 precondition chip present', chips().length === 1, String(chips().length))
  render([para(0, ['alpha '])], true)
  await tick()
  check('S13 stale mirror retired', chips().length === 0, String(chips().length))
  check('S13 no duplicate prose', transcript(p()) === 'alpha ', JSON.stringify(transcript(p())))
  check('S13 mirror box gone', p().querySelector('[data-dsq-ann-mirror]') === null)
  // And the message is finished: no further chunk will ever repair it.
  render([para(0, ['alpha '])], false)
  await tick()
  check('S13 still clean after stream end', transcript(p()) === 'alpha ', JSON.stringify(transcript(p())))
}

/**
 * Point 1: can an insertion record reach us before the deletion of the node
 * whose mirror the new node would adopt? React commits deletions before
 * placements, and MutationObserver hands records over in chronological order.
 */
async function recordOrder(): Promise<void> {
  await settle()
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  const seen: string[] = []
  const obs = new MutationObserver(recs => {
    for (const r of recs) seen.push(`${r.type}:${r.removedNodes.length}/${r.addedNodes.length}`)
  })
  obs.observe(p(), { childList: true, subtree: true, characterData: true })
  render([para(0, inline(`**bold** alpha ${D(1)} beta`))], true)
  await tick()
  obs.disconnect()
  check('S14 deletion recorded before insertion', seen[0] === 'childList:1/0', seen.join(' '))
  check('S14 no orphan after re-reconcile', transcript(p()) === expected(`**bold** alpha ${D(1)} beta`),
    JSON.stringify(transcript(p())))
}

/** Does Blink queue a characterData record when nodeValue is set to itself? */
async function identicalWrite(): Promise<void> {
  await settle()
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  const node = p().firstChild as Text
  const seen: string[] = []
  const obs = new MutationObserver(recs => {
    for (const r of recs) seen.push(`${r.type}:${JSON.stringify(r.oldValue)}`)
  })
  obs.observe(node, { characterData: true, characterDataOldValue: true })
  node.nodeValue = node.nodeValue
  await tick()
  check('S15 identical nodeValue write queues a record', seen.length > 0, seen.join(' ') || 'none')
  obs.disconnect()
}

/** Which records does the S10b transition actually produce for the host node? */
async function rewriteRecords(): Promise<void> {
  await settle()
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  const node = p().firstChild as Text
  const seen: string[] = []
  const obs = new MutationObserver(recs => {
    for (const r of recs) {
      const who = r.target === node ? 'host' : r.target.nodeName
      seen.push(`${r.type}@${who}:${JSON.stringify(r.oldValue)}→${JSON.stringify((r.target as Text).nodeValue)}`)
    }
  })
  obs.observe(p(), { childList: true, subtree: true, characterData: true, characterDataOldValue: true })
  render([para(0, inline(`alpha **bold** ${D(1)} beta`))], true)
  await tick()
  obs.disconnect()
  check('S16 host rewrite is observable even when the value is unchanged',
    seen[0]?.startsWith('characterData@host') === true, seen.join(' | '))
}

function report(): void {
  const failed = results.filter(r => !r.ok)
  ;(window as unknown as Record<string, unknown>).__mirrorResults = {
    total: results.length,
    failed: failed.length,
    failures: failed,
    all: results,
  }
  document.title = failed.length === 0 ? `PASS ${results.length}` : `FAIL ${failed.length}/${results.length}`
  const out = document.getElementById('out') ?? document.createElement('pre')
  out.id = 'out'
  out.textContent = JSON.stringify({ total: results.length, failed: failed.length, failures: failed }, null, 1)
  document.body.appendChild(out)
}

async function main(): Promise<void> {
  for (const [name, fn] of [
    ['streamingProse', streamingProse],
    ['batchedCommits', batchedCommits],
    ['orphanCleanup', orphanCleanup],
    ['inlineCode', inlineCode],
    ['multipleDirectives', multipleDirectives],
    ['inlineGrowth', inlineGrowth],
    ['prefixRewrite', prefixRewrite],
    ['recordOrder', recordOrder],
    ['identicalWrite', identicalWrite],
    ['rewriteRecords', rewriteRecords],
  ] as const) {
    try {
      await fn()
    } catch (error) {
      check(`${name} threw`, false, `${String(error)}\n${(error as Error).stack ?? ''}`)
    }
  }
  // Leave a live streaming paragraph, then drop the watcher the way a host
  // module reload does: the document and React's DOM stay, module state goes.
  // reload.js is a separate module instance with an empty WeakMap.
  render([para(0, [`alpha ${D(1)} beta`])], true)
  await tick()
  const state = {
    hostNode: p().firstChild as Text,
    chipBefore: chips()[0] as HTMLElement,
    results,
    report,
  }
  dispose()
  ;(window as unknown as Record<string, unknown>).__reload = state
  const script = document.createElement('script')
  script.src = './reload.js'
  document.body.appendChild(script)
}

void main()