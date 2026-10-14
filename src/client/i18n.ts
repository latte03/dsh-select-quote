/**
 * Copy for dsh-select-quote, served through the host locale service.
 *
 * The active language is owned by `@deepseek-ai/dsh-client-locale` (Settings →
 * General → Language, persisted as `locale.preference`). This module owns only
 * the dictionaries and the plural form selection that the host's plain-template
 * lookup cannot express; it never resolves a language on its own.
 *
 * NOT localized on purpose:
 *   - wire markers (`> [选中文本]`, `<response-annotations>`,
 *     `:dsh-annotation{index="N"}`) — they are the message format the model
 *     and the transcript parser agree on;
 *   - the `# Response annotations:` header — model-facing instruction prose,
 *     not UI text.
 */

export const LOCALE_NS = 'select-quote'

/** Dictionary keys are flat strings; `{name}` placeholders are filled by the host. */
export type LocaleDict = Record<string, string>

/**
 * Count-bearing messages carry one key per plural form instead of a base key,
 * because the host resolves a single template string per key.
 */
const PLURAL_FORMS = ['one', 'few', 'many', 'other'] as const
type PluralForm = (typeof PLURAL_FORMS)[number]

const zh: LocaleDict = {
  'common.selectedText': '选中的文本',
  'common.commentPlaceholder': '添加可选评论…',
  'common.cancel': '取消',
  'common.save': '保存',

  'toolbar.aria': '划词操作',
  'toolbar.commentHint': '添加批注…',
  'toolbar.copy': '复制',
  'toolbar.copyFailed': '复制失败',
  'toolbar.addToTask': '添加到任务',
  'toolbar.commentDialogAria': '添加可选评论',
  'toolbar.skipComment': '暂不评论',
  'toolbar.addComment': '添加评论',

  'card.commentSubtitle': '评论 · {comment}',
  'card.ariaIndexed': '批注 {index}',
  'card.ariaPlain': '划词批注',
  'card.editComment': '编辑评论',
  'card.remove': '移除批注',

  'summary.hint': '悬停查看批注',
  'summary.dialogAria': '{count} 条划词批注详情',
  'summary.edit': '编辑批注 {index}',
  'summary.remove': '移除批注 {index}',
  'summary.userComment': '用户评论',
  'summary.noComment': '未添加评论',
  'summary.aria.other': '{count} 条划词批注。悬停查看详情。',
  'summary.title.other': '{count} 条批注',
  'summary.removeAll': '移除全部划词批注',

  'chip.annotation': '批注 {index}',
}

const en: LocaleDict = {
  'common.selectedText': 'Selected text',
  'common.commentPlaceholder': 'Add an optional comment…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',

  'toolbar.aria': 'Selection actions',
  'toolbar.commentHint': 'Add annotation…',
  'toolbar.copy': 'Copy',
  'toolbar.copyFailed': 'Copy failed',
  'toolbar.addToTask': 'Add to task',
  'toolbar.commentDialogAria': 'Add an optional comment',
  'toolbar.skipComment': 'Skip comment',
  'toolbar.addComment': 'Add comment',

  'card.commentSubtitle': 'Comment · {comment}',
  'card.ariaIndexed': 'Annotation {index}',
  'card.ariaPlain': 'Selection annotation',
  'card.editComment': 'Edit comment',
  'card.remove': 'Remove annotation',

  'summary.hint': 'Hover to view annotations',
  'summary.dialogAria': 'Annotation details: {count}',
  'summary.edit': 'Edit annotation {index}',
  'summary.remove': 'Remove annotation {index}',
  'summary.userComment': 'User comment',
  'summary.noComment': 'No comment added',
  'summary.aria.one': '{count} annotation. Hover to view details.',
  'summary.aria.other': '{count} annotations. Hover to view details.',
  'summary.title.one': '{count} annotation',
  'summary.title.other': '{count} annotations',
  'summary.removeAll': 'Remove all annotations',

  'chip.annotation': 'Annotation {index}',
}

/**
 * Russian is not a shipped host locale: it is added through
 * `ctx.locale.addLanguage()` and its dictionary through the three-argument
 * `register()`. Its fallback chain ends at `en`, as the host requires.
 */
const ru: LocaleDict = {
  'common.selectedText': 'Выделенный текст',
  'common.commentPlaceholder': 'Добавить необязательный комментарий…',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',

  'toolbar.aria': 'Действия с выделенным текстом',
  'toolbar.commentHint': 'Добавить аннотацию…',
  'toolbar.copy': 'Копировать',
  'toolbar.copyFailed': 'Не удалось скопировать',
  'toolbar.addToTask': 'Добавить к задаче',
  'toolbar.commentDialogAria': 'Добавить необязательный комментарий',
  'toolbar.skipComment': 'Без комментария',
  'toolbar.addComment': 'Добавить комментарий',

  'card.commentSubtitle': 'Комментарий · {comment}',
  'card.ariaIndexed': 'Аннотация {index}',
  'card.ariaPlain': 'Аннотация к выделенному тексту',
  'card.editComment': 'Изменить комментарий',
  'card.remove': 'Удалить аннотацию',

  'summary.hint': 'Наведите, чтобы увидеть аннотации',
  'summary.dialogAria': 'Детали аннотаций: {count}',
  'summary.edit': 'Изменить аннотацию {index}',
  'summary.remove': 'Удалить аннотацию {index}',
  'summary.userComment': 'Комментарий пользователя',
  'summary.noComment': 'Комментарий не добавлен',
  'summary.aria.one': '{count} аннотация. Наведите, чтобы увидеть детали.',
  'summary.aria.few': '{count} аннотации. Наведите, чтобы увидеть детали.',
  'summary.aria.many': '{count} аннотаций. Наведите, чтобы увидеть детали.',
  'summary.aria.other': '{count} аннотаций. Наведите, чтобы увидеть детали.',
  'summary.title.one': '{count} аннотация',
  'summary.title.few': '{count} аннотации',
  'summary.title.many': '{count} аннотаций',
  'summary.title.other': '{count} аннотаций',
  'summary.removeAll': 'Удалить все аннотации',

  'chip.annotation': 'Аннотация {index}',
}

/** Both shipped host locales, required together by the typed `register()`. */
export const SHIPPED_DICTS: Readonly<Record<'zh' | 'en', LocaleDict>> = Object.freeze({ zh, en })

/** Dictionary for the language registered through {@link LANGUAGE_RU}. */
export const DICTIONARIES: Readonly<Record<string, LocaleDict>> = Object.freeze({ zh, en, ru })

export const LANGUAGE_RU = Object.freeze({ id: 'ru', label: 'Русский', fallback: 'en' as const })

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

function pluralForm(count: number): PluralForm {
  const locale = activeLocale()
  if (locale === 'ru') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    return 'many'
  }
  if (locale === 'en') return count === 1 ? 'one' : 'other'
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
