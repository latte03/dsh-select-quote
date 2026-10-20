/**
 * Ambient faces for the client services this plugin injects.
 *
 * `ctx.slots` and `ctx.locale` are owned by the running dsh
 * deployment (the `@deepseek-ai/dsh-client-*` web packages), which are not
 * dependencies of this repository. Their `Context` augmentation is restated
 * here so `npm run typecheck` works without the full client install.
 */

import type { Context } from '@deepseek-ai/cordis'

/** One live slot entry as exposed by the registry inspection surface. */
export interface SlotEntryInspection {
  /** Registered component (memo/forwardRef/plain function). */
  component?: unknown
  /** Discriminating registration options; `key` for keyed slots. */
  options?: { key?: string; priority?: number }
  /** Fiber/registrant name, for diagnostics only. */
  registrant?: string
}

/** Options accepted by `ctx.slots.register` for the slots this plugin uses. */
export interface SlotRegistration {
  name: string
  /** Cell key of a `list` slot entry. */
  id?: string
  /** Cell key of a `keyed` slot entry. */
  key?: string
  order?: number
  priority?: number
  locale?: string
}

/** One selectable language. */
export interface LocaleDefinition {
  id: string
  /** Display name written in the represented language. */
  label: string
  /** Next language in the per-key fallback chain; absent only for English. */
  fallback?: string
}

/** Immutable locale state published on every change. */
export interface LocaleSnapshot {
  active: string
  locales: readonly LocaleDefinition[]
  /** Bumped on both locale switches and dictionary registrations. */
  revision: number
}

/** Browser-side locale registry (`@deepseek-ai/dsh-client-locale`). */
export interface LocaleRuntime {
  getLocale(): LocaleSnapshot
  getSnapshot(): LocaleSnapshot
  subscribe(fn: () => void): () => void
  /** The only user preference write entry; unknown ids throw. */
  setLocale(id: string): void
  /** Adds a selectable language whose fallback chain must end at `en`. */
  addLanguage(input: LocaleDefinition): () => void
  /** Typed form: every shipped locale at once. */
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
  /** Language-pack form: one locale of an externally registered language. */
  register(ns: string, locale: string, dict: Record<string, string>): () => void
  /** Stable per-namespace translate, resolved against the active locale. */
  bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  resolveText(text: unknown): string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: {
      inject(key: string, callback: () => unknown): () => void
      register(options: SlotRegistration, component: unknown): () => void
      /** All live entries for a key, including entries shadowed by a winner. */
      entries(key: string): ReadonlyArray<SlotEntryInspection>
    }
    locale: LocaleRuntime
  }
}
