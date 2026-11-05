/**
 * Copy for dsh-select-quote, served through the host locale service.
 *
 * The active language is owned by `@deepseek-ai/dsh-client-locale` (Settings →
 * General → Language, persisted as `locale.preference`). This module owns the
 * plural form selection and the locale API; each dictionary lives in its own
 * `./i18n/<lang>.ts` file, so adding or fixing copy touches one language file.
 * The plugin never resolves a language on its own.
 *
 * NOT localized on purpose:
 *   - wire markers (`> [选中文本]`, `<response-annotations>`,
 *     `:dsh-annotation{index="N"}`) — they are the message format the model
 *     and the transcript parser agree on;
 *   - the `# Response annotations:` header — model-facing instruction prose,
 *     not UI text.
 *
 * Dictionaries cover every language dsh can select: the two baseline locales
 * (`zh` / `en`) plus the language packs the Host ships from 0.2.2-alpha.2 on
 * (`ja` / `es` / `fr` / `de` / `ru` / `pt`). On older Hosts those packs are
 * added by this plugin through `addLanguage()`.
 */

import { zh } from './i18n/zh.ts'
import { en } from './i18n/en.ts'
import { ja } from './i18n/ja.ts'
import { es } from './i18n/es.ts'
import { fr } from './i18n/fr.ts'
import { de } from './i18n/de.ts'
import { ru } from './i18n/ru.ts'
import { pt } from './i18n/pt.ts'
import type { LocaleDict } from './i18n/types.ts'

export type { LocaleDict } from './i18n/types.ts'

export const LOCALE_NS = 'select-quote'

const PLURAL_FORMS = ['one', 'few', 'many', 'other'] as const
type PluralForm = (typeof PLURAL_FORMS)[number]

export const SHIPPED_DICTS: Readonly<Record<'zh' | 'en', LocaleDict>> = Object.freeze({ zh, en })

/**
 * Language packs the Host ships from 0.2.2-alpha.2 on. Older Hosts only carry
 * `zh` / `en`, so the plugin adds each missing pack through `addLanguage()`;
 * the ids and labels match the Host's own so a later Host upgrade keeps the
 * same settings entry.
 */
export const OPTIONAL_LANGUAGES = Object.freeze([
  { id: 'ja', label: '日本語', fallback: 'en' as const },
  { id: 'es', label: 'Español', fallback: 'en' as const },
  { id: 'fr', label: 'Français', fallback: 'en' as const },
  { id: 'de', label: 'Deutsch', fallback: 'en' as const },
  { id: 'ru', label: 'Русский', fallback: 'en' as const },
  { id: 'pt', label: 'Português', fallback: 'en' as const },
])

/** Every dictionary this plugin serves, keyed by language id. */
export const DICTIONARIES: Readonly<Record<string, LocaleDict>> = Object.freeze({
  zh,
  en,
  ja,
  es,
  fr,
  de,
  ru,
  pt,
})

export interface LocaleApi {
  translate(key: string, params?: Record<string, unknown>): string
  getActive(): string
  getRevision(): number
  subscribe(listener: () => void): () => void
}

let api: LocaleApi | undefined

/**
 * Install the host-bound translation entry point. Called once from `apply()`
 * with `ctx.locale.bind(LOCALE_NS)` and the live snapshot accessors.
 */
export function bindLocale(next: LocaleApi): void {
  api = next
}

/** Active language id, or `en` before the host service is bound. */
export function activeLocale(): string {
  return api?.getActive() ?? 'en'
}

/** Languages whose CLDR rule for the counts this UI renders is one/other. */
const ONE_OTHER_LOCALES = new Set(['en', 'es', 'fr', 'de', 'pt'])

function pluralForm(count: number): PluralForm {
  const locale = activeLocale()
  if (locale === 'ru') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    return 'many'
  }
  if (ONE_OTHER_LOCALES.has(locale)) return count === 1 ? 'one' : 'other'
  return 'other'
}

/**
 * Translate a `select-quote` key. A numeric `count` selects a plural form and
 * the matching `key.form` entry is used, falling back to `key.other`.
 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  if (!api) return key
  if (typeof params.count === 'number') {
    const form = pluralForm(params.count)
    const exact = api.translate(`${key}.${form}`, params)
    if (exact !== `${key}.${form}`) return exact
    const other = api.translate(`${key}.other`, params)
    if (other !== `${key}.other`) return other
  }
  return api.translate(key, params)
}

/**
 * Subscribe to language or dictionary changes. Components go through
 * `useLocale()` instead; this is the non-React entry point (DOM decorations).
 * Subscribing before the host service is bound is a no-op, so callers subscribe
 * from `apply()`, after `bindLocale()`.
 */
export function subscribeLocale(listener: () => void): () => void {
  return api ? api.subscribe(listener) : () => {}
}

/** Monotonic host revision counter, bumped on locale and dictionary changes. */
export function localeRevision(): number {
  return api?.getRevision() ?? 0
}
