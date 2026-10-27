/**
 * Ambient faces for the client services this plugin injects.
 *
 * `ctx.slots` and `ctx.locale` are owned by the running dsh
 * deployment (the `@deepseek-ai/dsh-client-*` web packages), which are not
 * dependencies of this repository. Their `Context` augmentation is restated
 * here so `npm run typecheck` works without the full client install.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ModelDirectoryFace } from './model/types.ts'

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
  /** Props this entry contributes at render time; the Host merges them in. */
  inject?: () => Record<string, unknown>
}

/** One selectable language. */
export interface LocaleDefinition {
  id: string
  /** Display name written in the represented language. */
  label: string
  /** Next language in the per-key fallback chain; absent only for English. */
  fallback?: string
}

/** Shared config-form snapshot for one Host plugin entry. */
export interface ConfigFormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  /** Effective value: defaults, patch overlay, and the user's overrides. */
  value?: unknown
  base?: unknown
  user?: unknown
  revision?: number
  writable?: boolean
}

/** Browser-side config store owned by `@deepseek-ai/dsh-client-ui-settings`. */
export interface ConfigFormController {
  getSnapshot(): ConfigFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

/** One physical key combination a shortcut command can declare. */
export interface ShortcutBinding {
  /** `KeyboardEvent.code` (e.g. `KeyL`). */
  code: string
  secondCode?: string
  /** `primary` expands to Command on macOS and Control elsewhere. */
  modifiers: readonly string[]
}

/** Device profiles a command declares its default for; omitted means unbound. */
export type ShortcutProfile =
  | 'desktop:macos'
  | 'desktop:windows'
  | 'desktop:linux'
  | 'web:macos'
  | 'web:windows'
  | 'web:linux'

export type ShortcutRegion = 'page' | 'editable' | 'terminal'

/** One effective row in the Host's shortcut reference. */
export interface ShortcutCatalogRow {
  id: string
  label: string
  /** Keycap labels for the active binding; empty when the command is unbound. */
  keys: readonly string[]
  /** Non-null when the Host rejects the binding (reserved or unsupported). */
  issue: string | null
  /** Commands currently holding the same binding. */
  conflicts: readonly string[]
}

/** Feature-owned command registered with `ctx.shortcuts`. */
export interface ShortcutCommand {
  id: string
  label: () => string
  aliases?: readonly string[]
  defaults: Partial<Record<ShortcutProfile, ShortcutBinding>>
  regions: readonly ShortcutRegion[]
  /** Modal ids the command may run under; `[]` blocks while a modal is open. */
  modals: readonly string[]
  resolve(context: {
    region: ShortcutRegion
    modal: string | null
    target?: Element
    source?: 'keyboard' | 'menu'
  }):
    | { status: 'handled'; run: () => void }
    | { status: 'blocked'; reason: string }
    | { status: 'pass' }
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
    configForms: {
      /** Host config form keyed by the Loader row id, not the package name. */
      get(entryId: string): ConfigFormController
      /** Runs `register` while any listed namespace is served; returns a disposer. */
      whileServed(
        namespaces: readonly string[],
        register: (served: ReadonlySet<string>) => () => void,
      ): () => void
      /** Shared describe mirror; introspection/debug surface. */
      describe(): unknown
    }
    shortcuts: {
      /** Registers one command for the current plugin scope; throws on conflicts. */
      register(command: ShortcutCommand): () => void
      /** Effective bindings for every registered command in this window. */
      catalog: {
        getSnapshot(): readonly ShortcutCatalogRow[]
        subscribe(listener: () => void): () => void
      }
    }
    /** Typed Remote mount (`@deepseek-ai/dsh-api-gateway`, client face). */
    remote: {
      $mount(contribution: unknown): Promise<() => Promise<void>>
      selectQuoteSideTask: {
        create(input: {
          agentId: string
          prompt: string
          label?: string
        }): Promise<{ childId: string }>
      }
    }
    /** Right sidebar controller (`@deepseek-ai/dsh-client-ui-sidebar-right`). */
    sidebarRight: {
      openResource(address: string, options?: { kind?: string }): void
    }
    /** Client session controller (`@deepseek-ai/dsh-client-ui-session`). */
    sessions: {
      list: {
        getSnapshot(): {
          byId: Record<string, { origin?: string } | undefined>
        }
      }
    }
    /**
     * Model catalog controller (`@deepseek-ai/dsh-client-ui-model-selection`).
     * Only the read face is used: the picker never switches the session route.
     */
    modelDirectories: {
      directoryFor(sessionId: string): ModelDirectoryFace
    }
  }
}
