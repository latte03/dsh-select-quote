import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { bindTestLocale } from '../i18n.testkit.ts'
import { t as translate } from '../i18n.ts'
import { SettingsTabs } from './SettingsTabs.tsx'
import { SettingsNotice, SettingsPanel, SettingRow, SwitchRow } from './rows.tsx'
import { SETTINGS_GROUPS, panelId, tabId } from './settingsGroups.ts'

/**
 * Structural smoke tests for the settings page.
 *
 * The tabs are the one place where a11y wiring is entirely ours (role, roving
 * tabindex, panel linkage), and the rows are the shapes every switch is built
 * from — both are worth a string render even though the page is assembled by the
 * host. Interaction (arrows, Home/End, the refused last switch) still needs a
 * DOM; `settingsGroups.test.ts` covers the ordering and the keep-one rule.
 */

bindTestLocale('zh')

/** Group labels are stubbed so the order assertion reads unambiguously; every
 *  other key goes through the bound dictionary, exactly like the real call. */
const t = (key: string): string => {
  const group = SETTINGS_GROUPS.find((entry) => entry.labelKey === key)
  return group ? `T:${group.id}` : translate(key)
}

describe('SettingsTabs', () => {
  const html = renderToStaticMarkup(<SettingsTabs group="buttons" onSelect={() => {}} t={t} />)

  it('exposes the tablist with one tab per group, in order', () => {
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="配置分组"')
    const order = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((match) => match[1])
    expect(order).toEqual(SETTINGS_GROUPS.map((group) => group.id))
  })

  it('marks exactly one tab as selected and reachable by Tab', () => {
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html.match(/aria-selected="false"/g)).toHaveLength(SETTINGS_GROUPS.length - 1)
    // Roving tabindex: Tab lands on the strip once, arrows move inside.
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(SETTINGS_GROUPS.length - 1)
    expect(html).toContain(`data-active="true"`)
  })

  it('links the selected tab to its panel', () => {
    expect(html).toContain(`id="${tabId('buttons')}"`)
    expect(html).toContain(`aria-controls="${panelId('buttons')}"`)
    for (const group of SETTINGS_GROUPS) {
      expect(html).toContain(`id="${tabId(group.id)}"`)
    }
    // A non-selected tab names no panel, so assistive tech never announces a
    // target that is not rendered.
    expect(html).not.toContain(`aria-controls="${panelId('translate')}"`)
  })
})

describe('settings rows', () => {
  it('wraps a panel around its tab label', () => {
    const out = renderToStaticMarkup(
      <SettingsPanel group="entry">
        <span>row</span>
      </SettingsPanel>,
    )
    expect(out).toContain('role="tabpanel"')
    expect(out).toContain(`id="${panelId('entry')}"`)
    expect(out).toContain(`aria-labelledby="${tabId('entry')}"`)
    expect(out).toContain('<span>row</span>')
  })

  it('drops the hint row when there is no hint', () => {
    const withHint = renderToStaticMarkup(
      <SettingRow label="浮层位置" hint="放不下自动翻面">
        <span />
      </SettingRow>,
    )
    const withoutHint = renderToStaticMarkup(
      <SettingRow label="浮层位置">
        <span />
      </SettingRow>,
    )
    expect(withHint).toContain('放不下自动翻面')
    expect(withoutHint).not.toContain('放不下自动翻面')
    expect(withoutHint).toContain('浮层位置')
  })

  it('gives the switch a labelled checkbox and its live state', () => {
    const on = renderToStaticMarkup(
      <SwitchRow label="复制" hint="显示复制按钮" on onChange={() => {}} />,
    )
    const off = renderToStaticMarkup(
      <SwitchRow label="复制" hint="显示复制按钮" on={false} onChange={() => {}} />,
    )
    expect(on).toContain('type="checkbox"')
    expect(on).toContain('aria-label="复制"')
    expect(on).toContain('checked=""')
    expect(off).not.toContain('checked=""')
    // The track carries the state for CSS; the checkbox carries it for AT.
    expect(on).toContain('data-on="true"')
    expect(off).toContain('data-on="false"')
  })

  it('announces a notice instead of only painting it', () => {
    const out = renderToStaticMarkup(<SettingsNotice text="至少要留一个按钮" />)
    expect(out).toContain('role="status"')
    expect(out).toContain('至少要留一个按钮')
  })
})
