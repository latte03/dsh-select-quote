/**
 * Bind a shipped dictionary as the active locale for a test.
 *
 * `t()` answers the raw key before `bindLocale()` runs (there is no host
 * service in a test process), so any assertion on visible copy has to install
 * one first. Mirroring the real chain matters: `t()` interpolates `{name}` and
 * resolves plural keys through `api.translate()`, so the fake receives composed
 * keys like `summary.title.other` and must look them up verbatim.
 */

import { bindLocale, SHIPPED_DICTS } from './i18n.ts'

export function bindTestLocale(locale: 'zh' | 'en' = 'zh'): void {
  const dict: Readonly<Record<string, string>> = SHIPPED_DICTS[locale]
  bindLocale({
    translate: (key, params) => {
      const raw = dict[key]
      if (typeof raw !== 'string') return key
      if (params === undefined) return raw
      return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = params[name]
        return value === undefined ? match : String(value)
      })
    },
    getActive: () => locale,
    getRevision: () => 0,
    subscribe: () => () => {},
  })
}
