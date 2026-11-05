import { describe, expect, it } from 'vitest'
import type { SelectionSnapshot } from '../dom/selection.ts'
import { selectionActions, splitLabelAt } from './actions.ts'

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
      'translate',
      'add',
      'side',
    ])
  })

  it('leads with open-link when the selection resolves to a URL', () => {
    expect(selectionActions(snapshot('https://example.com')).map((action) => action.key)).toEqual([
      'open',
      'copy',
      'translate',
      'add',
      'side',
    ])
  })

  it('offers nothing to open for a non-http anchor', () => {
    expect(
      selectionActions(snapshot('javascript:alert(1)')).map((action) => action.key),
    ).toEqual(['copy', 'translate', 'add', 'side'])
  })
})

describe('splitLabelAt', () => {
  it('marks only the target name, keeping the translated word order', () => {
    expect(splitLabelAt('放入 修复登录', '修复登录')).toEqual([
      { text: '放入 ' },
      { text: '修复登录', accent: true },
    ])
    expect(splitLabelAt('Put into Fix login', 'Fix login')).toEqual([
      { text: 'Put into ' },
      { text: 'Fix login', accent: true },
    ])
  })

  it('leaves the label whole when there is no name or no match', () => {
    expect(splitLabelAt('放入会话…', undefined)).toEqual([{ text: '放入会话…' }])
    expect(splitLabelAt('放入会话…', '别名')).toEqual([{ text: '放入会话…' }])
  })
})
