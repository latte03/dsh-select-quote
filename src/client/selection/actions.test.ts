import { describe, expect, it } from 'vitest'
import type { SelectionSnapshot } from '../dom/selection.ts'
import {
  destinationRows,
  selectionActions,
  splitLabelAt,
  type SelectionActionEntry,
} from './actions.ts'

function snapshot(
  anchorHref?: string,
  surface: SelectionSnapshot['surface'] = 'transcript',
): SelectionSnapshot {
  return {
    text: '一段正文',
    surface,
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
      'annotate',
      'side',
    ])
  })

  it('leads with open-link when the selection resolves to a URL', () => {
    expect(selectionActions(snapshot('https://example.com')).map((action) => action.key)).toEqual([
      'open',
      'copy',
      'translate',
      'annotate',
      'side',
    ])
  })

  it('offers nothing to open for a non-http anchor', () => {
    expect(
      selectionActions(snapshot('javascript:alert(1)')).map((action) => action.key),
    ).toEqual(['copy', 'translate', 'annotate', 'side'])
  })

  it('drops translate when the selection already is the target language', () => {
    expect(
      selectionActions(snapshot(), undefined, { hideTranslate: true }).map((action) => action.key),
    ).toEqual(['copy', 'annotate', 'side'])
  })

  it('omits the side question for a file selected in the Sidebar', () => {
    expect(
      selectionActions(snapshot(undefined, 'sidebarFile')).map((action) => action.key),
    ).toEqual(['copy', 'translate', 'annotate'])
  })
})

describe('annotation destinations', () => {
  it('splits 批注 into here plus the places it can go', () => {
    const entry = selectionActions(snapshot(), {
      available: true,
      label: '放入 修复登录',
      targetName: '修复登录',
      menuLabel: '放入会话…',
    }).find((action) => action.key === 'annotate')
    expect(entry?.destinations?.map((destination) => destination.key)).toEqual([
      'target',
      'picker',
    ])
  })

  it('offers no destinations without a hand-off directory', () => {
    const entry = selectionActions(snapshot()).find((action) => action.key === 'annotate')
    expect(entry?.destinations).toBeUndefined()
  })
})

describe('destinationRows', () => {
  const split = (): SelectionActionEntry => ({
    key: 'annotate',
    icon: 'plus',
    label: '批注',
    destinations: [
      { key: 'target', label: '放入 修复登录' },
      { key: 'picker', label: '放入会话…' },
    ],
    onClick: () => {},
  })

  it('expands one entry into a row per destination', () => {
    const picked: string[] = []
    const rows = destinationRows(split(), (destination) => picked.push(destination))
    expect(rows.map((row) => row.label)).toEqual(['放入 修复登录', '放入会话…'])
    rows[1]?.onClick()
    expect(picked).toEqual(['picker'])
  })

  it('leaves an entry without destinations whole', () => {
    const plain: SelectionActionEntry = {
      key: 'copy',
      icon: 'copy',
      label: '复制',
      onClick: () => {},
    }
    expect(destinationRows(plain, () => {})).toEqual([plain])
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
