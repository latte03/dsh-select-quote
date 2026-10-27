import { describe, expect, it } from 'vitest'
import type { SelectionSnapshot } from '../dom/selection.ts'
import { selectionActions } from './actions.ts'

function snapshot(anchorHref?: string): SelectionSnapshot {
  return {
    text: '一段正文',
    left: 0,
    top: 0,
    below: false,
    selectionBottom: 0,
    layer: {} as SelectionSnapshot['layer'],
    ...(anchorHref === undefined ? {} : { anchorHref }),
  }
}

describe('selection actions', () => {
  it('lists every entry point once, in render order', () => {
    expect(selectionActions(snapshot()).map((action) => action.key)).toEqual([
      'copy',
      'add',
      'side',
    ])
  })

  it('leads with open-link when the selection resolves to a URL', () => {
    expect(selectionActions(snapshot('https://example.com')).map((action) => action.key)).toEqual([
      'open',
      'copy',
      'add',
      'side',
    ])
  })

  it('offers nothing to open for a non-http anchor', () => {
    expect(
      selectionActions(snapshot('javascript:alert(1)')).map((action) => action.key),
    ).toEqual(['copy', 'add', 'side'])
  })
})
