import { afterEach, describe, expect, it } from 'vitest'
import { ensureToolbarStyles } from './styles.ts'

interface FakeSheet {
  textContent: string
  dataset: Record<string, string>
}

interface FakeHead {
  readonly appended: FakeSheet[]
  appendChild(node: FakeSheet): void
}

const original = (globalThis as { document?: unknown }).document

/** Install the smallest document `ensureToolbarStyles` can run against. */
function install(existing: FakeSheet | null): FakeHead {
  const head: FakeHead = {
    appended: [],
    appendChild(node: FakeSheet) {
      this.appended.push(node)
    },
  }
  const fake = {
    querySelector: () => existing,
    createElement: (): FakeSheet => ({ textContent: '', dataset: {} }),
    head,
  }
  ;(globalThis as { document?: unknown }).document = fake
  return head
}

afterEach(() => {
  ;(globalThis as { document?: unknown }).document = original
})

describe('ensureToolbarStyles', () => {
  it('injects the sheet once when the page has none', () => {
    const head = install(null)
    ensureToolbarStyles()
    expect(head.appended).toHaveLength(1)
    expect(head.appended[0]?.textContent).toContain('.dsq_hostPill')
  })

  it('rewrites a sheet an earlier copy of the module left behind', () => {
    // The Host reloads client modules while the document survives, so the tag
    // outlives the code that wrote it. A stale sheet has to be replaced.
    const stale: FakeSheet = { textContent: '/* the sheet from an older bundle */', dataset: {} }
    const head = install(stale)
    ensureToolbarStyles()
    expect(head.appended).toHaveLength(0)
    expect(stale.textContent).toContain('.dsq_hostPill')
    expect(stale.textContent).not.toContain('older bundle')
  })
})
