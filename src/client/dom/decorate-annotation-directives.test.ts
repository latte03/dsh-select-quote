import { describe, expect, it } from 'vitest'
import { isOnlyDirective, shouldChipCode, splitDirectives } from './decorateAnnotationDirectives.ts'

describe('isOnlyDirective', () => {
  it('accepts a bare numeric directive', () => {
    expect(isOnlyDirective(':dsh-annotation{index="1"}')).toBe(true)
    expect(isOnlyDirective('  :dsh-annotation{index="12"}  ')).toBe(true)
  })

  it('rejects the placeholder shape the protocol header quotes', () => {
    // `N` is a letter; the strict pattern only takes digits, and the header
    // itself contains this literal.
    expect(isOnlyDirective(':dsh-annotation{index="N"}')).toBe(false)
  })

  it('rejects a directive inside a sentence', () => {
    expect(isOnlyDirective('见 :dsh-annotation{index="1"} 处')).toBe(false)
  })

  it('rejects index zero', () => {
    expect(isOnlyDirective(':dsh-annotation{index="0"}')).toBe(false)
  })
})

describe('shouldChipCode', () => {
  it('chips the inline-code form the model was instructed to write', () => {
    const raw = ':dsh-annotation{index="1"}'
    expect(shouldChipCode(raw, raw, false)).toBe(true)
  })

  it('tolerates surrounding whitespace inside the code span', () => {
    expect(shouldChipCode(' :dsh-annotation{index="2"} ', ':dsh-annotation{index="2"}', false)).toBe(
      true,
    )
  })

  it('keeps fenced blocks literal', () => {
    const raw = ':dsh-annotation{index="1"}'
    expect(shouldChipCode(raw, raw, true)).toBe(false)
  })

  it('keeps a code span that holds more than the directive', () => {
    expect(
      shouldChipCode(':dsh-annotation{index="1"}', ':dsh-annotation{index="1"} 和别的', false),
    ).toBe(false)
  })

  it('keeps the placeholder literal', () => {
    const raw = ':dsh-annotation{index="N"}'
    expect(shouldChipCode(raw, raw, false)).toBe(false)
  })
})

describe('splitDirectives', () => {
  it('returns null without a directive', () => {
    expect(splitDirectives('普通正文')).toBeNull()
    expect(splitDirectives('')).toBeNull()
  })

  it('returns null for the placeholder shape the protocol header quotes', () => {
    expect(splitDirectives('见 :dsh-annotation{index="N"} 处')).toBeNull()
  })

  it('keeps the prose before the first directive as the host prefix', () => {
    expect(splitDirectives('见 :dsh-annotation{index="1"} 处')).toEqual({
      prefix: '见 ',
      segments: [
        { kind: 'chip', index: 1 },
        { kind: 'text', text: ' 处' },
      ],
    })
  })

  it('leaves an empty prefix when the directive opens the node', () => {
    expect(splitDirectives(':dsh-annotation{index="2"} 后文')).toEqual({
      prefix: '',
      segments: [
        { kind: 'chip', index: 2 },
        { kind: 'text', text: ' 后文' },
      ],
    })
  })

  it('omits the trailing text segment when the directive closes the node', () => {
    expect(splitDirectives('前文 :dsh-annotation{index="12"}')).toEqual({
      prefix: '前文 ',
      segments: [{ kind: 'chip', index: 12 }],
    })
  })

  it('plans every directive in order with the prose between them', () => {
    expect(splitDirectives('a :dsh-annotation{index="1"} b :dsh-annotation{index="3"} c')).toEqual({
      prefix: 'a ',
      segments: [
        { kind: 'chip', index: 1 },
        { kind: 'text', text: ' b ' },
        { kind: 'chip', index: 3 },
        { kind: 'text', text: ' c' },
      ],
    })
  })

  it('emits no empty text segment between adjacent directives', () => {
    expect(splitDirectives(':dsh-annotation{index="1"}:dsh-annotation{index="2"}')).toEqual({
      prefix: '',
      segments: [
        { kind: 'chip', index: 1 },
        { kind: 'chip', index: 2 },
      ],
    })
  })

  it('always starts the mirrored siblings with a chip', () => {
    const split = splitDirectives('x :dsh-annotation{index="1"}')
    expect(split?.segments[0]?.kind).toBe('chip')
  })
})
