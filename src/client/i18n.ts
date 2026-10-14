/**
 * Localization for dsh-select-quote (ru / en / zh).
 *
 * Upstream hardcodes Simplified Chinese UI strings. This module resolves a
 * locale from (in order):
 *
 *   1. `localStorage['dsq-locale']` — explicit user override ('ru' | 'en' | 'zh')
 *   2. `navigator.languages` / `navigator.language`
 *   3. 'en'
 *
 * `zh` keeps the original upstream wording and doubles as the fallback
 * dictionary, so a key missing from ru/en still renders something sensible.
 *
 * NOT localized on purpose:
 *   - wire markers (`> [选中文本]`, `<response-annotations>`,
 *     `:dsh-annotation{index="N"}`) — they are the message format the model
 *     and the transcript parser agree on;
 *   - the `# Response annotations:` header — model-facing instruction prose,
 *     not UI text.
 * Only human-facing chrome goes through `t()`.
 */

export type Locale = 'ru' | 'en' | 'zh'

export const LOCALES: readonly Locale[] = ['ru', 'en', 'zh']

/** Message value: a plain template, or plural forms selected by `{count}`. */
export interface PluralForms {
  readonly one?: string
  readonly few?: string
  readonly many?: string
  readonly other?: string
}

type MessageValue = string | PluralForms

interface Dictionary {
  readonly [key: string]: MessageValue
}

const STORAGE_KEY = 'dsq-locale'

const MESSAGES: Record<Locale, Dictionary> = {
  ru: {
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
    'summary.aria': {
      one: '{count} аннотация. Наведите, чтобы увидеть детали.',
      few: '{count} аннотации. Наведите, чтобы увидеть детали.',
      many: '{count} аннотаций. Наведите, чтобы увидеть детали.',
    },
    'summary.title': {
      one: '{count} аннотация',
      few: '{count} аннотации',
      many: '{count} аннотаций',
    },
    'summary.removeAll': 'Удалить все аннотации',

    'chip.annotation': 'Аннотация {index}',
  },

  en: {
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
    'summary.aria': {
      one: '{count} annotation. Hover to view details.',
      other: '{count} annotations. Hover to view details.',
    },
    'summary.title': {
      one: '{count} annotation',
      other: '{count} annotations',
    },
    'summary.removeAll': 'Remove all annotations',

    'chip.annotation': 'Annotation {index}',
  },

  // Upstream wording — also the fallback dictionary.
  zh: {
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
    'summary.aria': { other: '{count} 条划词批注。悬停查看详情。' },
    'summary.title': { other: '{count} 条批注' },
    'summary.removeAll': '移除全部划词批注',

    'chip.annotation': '批注 {index}',
  },
}

let cached: Locale | null = null

function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase()
  for (const locale of LOCALES) {
    if (lower === locale || lower.startsWith(`${locale}-`) || lower.startsWith(`${locale}_`)) {
      return locale
    }
  }
  return null
}

function localStore(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage
}

function readOverride(): Locale | null {
  try {
    const raw = localStore()?.getItem(STORAGE_KEY)
    return raw ? matchLocale(raw) : null
  } catch {
    // Storage can be unavailable (privacy mode, sandboxed frame).
    return null
  }
}

function detectLocale(): Locale {
  const override = readOverride()
  if (override) return override
  const nav = globalThis.navigator as Navigator | undefined
  const tags = nav ? [...(nav.languages ?? []), nav.language].filter(Boolean) : []
  for (const tag of tags) {
    const hit = matchLocale(tag)
    if (hit) return hit
  }
  return 'en'
}

/** Active locale (resolved once, then cached). */
export function getLocale(): Locale {
  cached ??= detectLocale()
  return cached
}

/**
 * Override the locale. Persisted to `localStorage`; existing React trees keep
 * their current strings until they re-render, so callers usually reload too.
 */
export function setLocale(locale: Locale | null): void {
  cached = locale
  try {
    if (locale) localStore()?.setItem(STORAGE_KEY, locale)
    else localStore()?.removeItem(STORAGE_KEY)
  } catch {
    // Best effort only.
  }
}

function pluralize(forms: PluralForms, locale: Locale, count: number): string {
  if (locale === 'ru') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return forms.one ?? forms.other ?? ''
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few ?? forms.other ?? ''
    return forms.many ?? forms.other ?? ''
  }
  if (locale === 'en') return (count === 1 ? forms.one : undefined) ?? forms.other ?? ''
  return forms.other ?? forms.many ?? ''
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Translate a key for the active locale.
 * `{name}` placeholders are filled from `params`; a numeric `count` also
 * selects the right plural form when the message is a `PluralForms` object.
 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  const locale = getLocale()
  const value = MESSAGES[locale][key] ?? MESSAGES.zh[key] ?? key
  const raw =
    typeof value === 'string'
      ? value
      : pluralize(value, locale, typeof params.count === 'number' ? params.count : 0)
  return interpolate(raw, params)
}
