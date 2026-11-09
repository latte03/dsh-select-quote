import { describe, expect, it } from 'vitest'
import { DRAFT_MARKER, stripDraftMarker } from '../protocol/quote-protocol.ts'
import { reconcileDraftMarker } from './useDraftMarker.ts'

describe('reconcileDraftMarker', () => {
  it('leaves an empty draft alone when no annotation is pending', () => {
    expect(reconcileDraftMarker('', 0)).toBeNull()
    expect(reconcileDraftMarker('words', 0)).toBeNull()
  })

  it('strips a marker left behind when the last annotation goes', () => {
    expect(reconcileDraftMarker(DRAFT_MARKER, 0)).toBe('')
    expect(reconcileDraftMarker(`words${DRAFT_MARKER}`, 0)).toBe('words')
    expect(reconcileDraftMarker(`  ${DRAFT_MARKER}`, 0)).toBe('  ')
  })

  it('marks a whitespace-only draft while annotations are pending', () => {
    expect(reconcileDraftMarker('', 1)).toBe(DRAFT_MARKER)
    expect(reconcileDraftMarker('  ', 1)).toBe(`  ${DRAFT_MARKER}`)
    expect(stripDraftMarker(reconcileDraftMarker('  ', 1) ?? '')).toBe('  ')
  })

  it('does not write twice and never touches real words', () => {
    expect(reconcileDraftMarker(DRAFT_MARKER, 1)).toBeNull()
    expect(reconcileDraftMarker('words', 1)).toBeNull()
    expect(reconcileDraftMarker(`words${DRAFT_MARKER}`, 1)).toBeNull()
  })
})
