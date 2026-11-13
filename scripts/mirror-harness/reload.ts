import { watchAnnotationDirectives } from '../../src/client/dom/decorateAnnotationDirectives.ts'

const D = (i: number): string => `:dsh-annotation{index="${i}"}`
const CHIP = '[data-dsq-ann-directive]'

interface Result { name: string; ok: boolean; detail: string }
interface State {
  hostNode: Text
  chipBefore: HTMLElement
  results: Result[]
  report: () => void
}

const state = (window as unknown as Record<string, unknown>).__reload as State
const dispose = watchAnnotationDirectives(document.body)
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0))

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

async function run(): Promise<void> {
  const { hostNode, chipBefore, results, report } = state
  const parent = hostNode.parentElement as Element
  const check = (name: string, ok: boolean, detail = ''): void => { results.push({ name, ok, detail }) }
  try {
    check('S8 precondition: host node holds only the prefix', hostNode.nodeValue === 'alpha ',
      JSON.stringify(hostNode.nodeValue))
    // React's next chunk, written the way commitTextUpdate writes it.
    hostNode.nodeValue = `alpha ${D(1)} beta gamma`
    await tick()
    check('S8 reload adopts mirrors instead of duplicating prose',
      prose(parent) === 'alpha  beta gamma', JSON.stringify(prose(parent)))
    check('S8 reload keeps exactly one chip', parent.querySelectorAll(CHIP).length === 1,
      String(parent.querySelectorAll(CHIP).length))
    check('S8 reload keeps chip identity', parent.querySelector(CHIP) === chipBefore)
    check('S8 host node still first and connected',
      parent.firstChild === hostNode && hostNode.isConnected)
    // A second chunk must keep working under the new instance.
    hostNode.nodeValue = `alpha ${D(1)} beta gamma delta`
    await tick()
    check('S8 second chunk after reload', prose(parent) === 'alpha  beta gamma delta',
      JSON.stringify(prose(parent)))
  } catch (error) {
    check('S8 threw', false, String(error))
  }
  dispose()
  report()
}

void run()