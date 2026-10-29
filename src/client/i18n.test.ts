import { describe, expect, it } from 'vitest'
import { bindLocale, DICTIONARIES, OPTIONAL_LANGUAGES, t } from './i18n.ts'

/** Bind a locale service whose templates come from the shipped dictionaries. */
function useLocale(active: string): void {
  bindLocale({
    translate(key, params) {
      const template = DICTIONARIES[active]?.[key] ?? key
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (whole, name) =>
        name in params ? String(params[name]) : whole,
      )
    },
    getActive: () => active,
    getRevision: () => 0,
    subscribe: () => () => {},
  })
}

describe('language coverage', () => {
  it('serves every language the host can select', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([
      'de',
      'en',
      'es',
      'fr',
      'ja',
      'pt',
      'ru',
      'zh',
    ])
    expect(OPTIONAL_LANGUAGES.map((language) => language.id)).toEqual([
      'ja',
      'es',
      'fr',
      'de',
      'ru',
      'pt',
    ])
  })
})

describe('plural form selection', () => {
  it.each([
    ['en', 1, 'one'],
    ['en', 2, 'other'],
    ['de', 1, 'one'],
    ['de', 2, 'other'],
    ['es', 1, 'one'],
    ['es', 2, 'other'],
    ['fr', 1, 'one'],
    ['fr', 2, 'other'],
    ['pt', 1, 'one'],
    ['pt', 2, 'other'],
    ['ru', 1, 'one'],
    ['ru', 2, 'few'],
    ['ru', 5, 'many'],
    ['ru', 11, 'many'],
    ['ja', 1, 'other'],
    ['zh', 1, 'other'],
  ] as const)('%s count %i picks the %s form', (locale, count, form) => {
    useLocale(locale)
    const template = DICTIONARIES[locale][`summary.title.${form}`]
    expect(t('summary.title', { count })).toBe(template.replace('{count}', String(count)))
  })
})

describe('template filling', () => {
  it('fills placeholders through the host template per language', () => {
    useLocale('fr')
    expect(t('mark.previewAria', { index: 3 })).toBe('Voir l’annotation 3')
    useLocale('de')
    expect(t('model.groupLoad', { name: 'Model', message: 'timeout' })).toBe(
      'Model konnte nicht geladen werden: timeout',
    )
    useLocale('ja')
    expect(t('summary.dialogAria', { count: 2 })).toBe('選択範囲の注釈 2 件')
  })
})
