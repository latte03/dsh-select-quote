import { describe, expect, it } from 'vitest'
import { popoverEnter } from './popover-keys.ts'

const base = {
  key: 'Enter',
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
}

describe('popover Enter gestures', () => {
  it('commits on plain Enter and on the Cmd/Ctrl chord, like the host composer', () => {
    expect(popoverEnter(base)).toBe('submit')
    expect(popoverEnter({ ...base, ctrlKey: true })).toBe('submit')
    expect(popoverEnter({ ...base, metaKey: true })).toBe('submit')
  })

  it('inserts a line break on Shift+Enter', () => {
    expect(popoverEnter({ ...base, shiftKey: true })).toBe('newline')
    expect(popoverEnter({ ...base, shiftKey: true, ctrlKey: true })).toBe('newline')
  })

  it('ignores other keys, Alt, both modifiers together, AltGraph and IME', () => {
    expect(popoverEnter({ ...base, key: 'a' })).toBe('ignore')
    expect(popoverEnter({ ...base, altKey: true })).toBe('ignore')
    expect(popoverEnter({ ...base, ctrlKey: true, metaKey: true })).toBe('ignore')
    expect(popoverEnter({ ...base, isComposing: true })).toBe('ignore')
    expect(popoverEnter({ ...base, getModifierState: (name) => name === 'AltGraph' })).toBe(
      'ignore',
    )
  })
})