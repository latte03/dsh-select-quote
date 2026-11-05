import { describe, expect, it } from 'vitest'
import { isOnlyDirective, shouldChipCode } from './decorateAnnotationDirectives.ts'

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
