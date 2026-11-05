import { describe, expect, it, vi } from 'vitest'
import { appendDraftText, writeDraft, type InputActionsFace } from './draft-write.ts'

/** A host generation without the append-only verb (dsh < 0.2.2). */
function legacyHost(): InputActionsFace & { written: string[] } {
  const written: string[] = []
  return {
    written,
    setDraft(text) {
      written.push(text)
    },
  }
}

/** dsh 0.2.2: Lexical editor exposing captureInsertion()/insertText(). */
function lexicalHost(initial: string) {
  let draft = initial
  let rev = 3
  const state = { inserted: [] as string[], setDraftCalls: 0, draft: () => draft }
  return {
    state,
    actions: {
      setDraft(text: string) {
        state.setDraftCalls += 1
        draft = text
        rev += 1
      },
      captureInsertion() {
        return { start: 0, end: draft.length, draftRev: rev }
      },
      insertText(text: string, span: { draftRev: number }) {
        if (span.draftRev !== rev) return false
        state.inserted.push(text)
        draft = text
        rev += 1
        return true
      },
    } satisfies InputActionsFace,
  }
}

describe('writeDraft', () => {
  it('rewrites in place on a host with the append-only verb', () => {
    const host = lexicalHost('用户的草稿')
    expect(writeDraft(host.actions, '新草稿', '用户的草稿')).toBe(true)
    expect(host.state.inserted).toEqual(['新草稿'])
    // The destructive path was never taken: quoting survives.
    expect(host.state.setDraftCalls).toBe(0)
  })

  it('falls back to setDraft on an older host', () => {
    const host = legacyHost()
    expect(writeDraft(host, '新草稿', '')).toBe(false)
    expect(host.written).toEqual(['新草稿'])
  })

  it('does nothing when the text already matches', () => {
    const host = lexicalHost('一样')
    expect(writeDraft(host.actions, '一样', '一样')).toBe(true)
    expect(host.state.inserted).toHaveLength(0)
    expect(host.state.setDraftCalls).toBe(0)
  })

  it('falls back when the host rejects the revision', () => {
    const host = lexicalHost('旧')
    const stale = { ...host.actions.captureInsertion!(), draftRev: 999 }
    host.actions.captureInsertion = () => stale
    writeDraft(host.actions, '新', '旧')
    // insertText refused (stale rev), so the caller still gets the text in.
    expect(host.state.setDraftCalls).toBe(1)
  })

  it('does not use the in-place verb for a non-whole-document change', () => {
    const host = lexicalHost('abc')
    host.actions.captureInsertion = () => ({ start: 1, end: 2, draftRev: 3 })
    writeDraft(host.actions, 'different', 'abc')
    expect(host.state.inserted).toHaveLength(0)
    expect(host.state.setDraftCalls).toBe(1)
  })
})

describe('appendDraftText', () => {
  it('inserts at a collapsed caret without clearing the document', () => {
    const host = lexicalHost('')
    const calls = host.actions.captureInsertion
    host.actions.captureInsertion = () => ({ start: 0, end: 0, draftRev: calls!().draftRev })
    expect(appendDraftText(host.actions, '\u200B')).toBe(true)
    expect(host.state.inserted).toEqual(['\u200B'])
    expect(host.state.setDraftCalls).toBe(0)
  })

  it('refuses to replace a live selection', () => {
    const host = lexicalHost('选中了这里')
    expect(appendDraftText(host.actions, 'x')).toBe(false)
    expect(host.state.inserted).toHaveLength(0)
  })

  it('is a no-op for empty text', () => {
    const host = lexicalHost('abc')
    expect(appendDraftText(host.actions, '')).toBe(true)
    expect(host.state.inserted).toHaveLength(0)
  })

  it('falls back to setDraft on an older host', () => {
    const host = legacyHost()
    const spy = vi.fn(host.setDraft)
    expect(appendDraftText({ ...host, setDraft: spy }, '文字')).toBe(false)
    expect(spy).toHaveBeenCalledWith('文字')
  })
})
