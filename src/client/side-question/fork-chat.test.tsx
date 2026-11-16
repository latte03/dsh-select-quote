import { beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { bindTestLocale } from '../i18n.testkit.ts'
import { SideForkTabTitle } from './fork-chat.tsx'
import { sideForkAddress } from './protocol.ts'

beforeAll(() => {
  bindTestLocale('zh')
})

function renderTitle(options: {
  visible: boolean
  active: boolean
  kind?: string
  title?: string
}): string {
  return renderToStaticMarkup(
    <SideForkTabTitle
      useTabInfo={() => ({
        tab: {
          id: 'tab1',
          kind: options.kind ?? 'select-quote-side',
          contentId: sideForkAddress('session-child'),
          title: options.title ?? '在侧边提问 · Fork',
          visible: options.visible,
        },
      })}
      isActiveTab={() => options.active}
    />,
  )
}

describe('SideForkTabTitle', () => {
  it('offers the keep action on the visible, active side-fork tab', () => {
    const html = renderTitle({ visible: true, active: true })
    expect(html).toContain('在侧边提问 · Fork')
    expect(html).toContain('dsq_keepTab')
    expect(html).toContain('aria-label="保留到列表"')
    // The chip clips its trailing edge; the action must lead the label to stay visible.
    expect(html.indexOf('dsq_keepTab')).toBeLessThan(html.indexOf('在侧边提问 · Fork'))
  })

  it('drops the action from an inactive tab title', () => {
    expect(renderTitle({ visible: true, active: false })).not.toContain('dsq_keepTab')
    expect(renderTitle({ visible: false, active: true })).not.toContain('dsq_keepTab')
  })

  it('drops the action for another tab kind', () => {
    expect(renderTitle({ visible: true, active: true, kind: 'terminal' })).not.toContain('dsq_keepTab')
  })

  it('falls back to the generic title when the captured title is blank', () => {
    const html = renderTitle({ visible: true, active: true, title: '   ' })
    expect(html).toContain('在侧边提问')
  })
})
