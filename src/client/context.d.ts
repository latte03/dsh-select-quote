/**
 * Ambient faces for the client services this plugin injects.
 *
 * `ctx.slots`, `ctx.sessions` and `ctx.uiConversation` are owned by the running
 * dsh deployment (the `@deepseek-ai/dsh-client-*` web packages), which are not
 * dependencies of this repository. Their `Context` augmentation is restated
 * here so `npm run typecheck` works without the full client install.
 */

import type { Context } from '@deepseek-ai/cordis'

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

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: {
      inject(key: string, callback: () => unknown): () => void
      register(options: SlotRegistration, component: unknown): () => void
    }
    sessions: {
      scope(id: string): Context | undefined
    }
    uiConversation: {
      events: { register(definition: unknown): () => void }
      views: { register(definition: unknown): () => void }
    }
  }
}
