import type { Context } from '@deepseek-ai/cordis'
import { QuoteCard } from './composer/AnnotationPanel.tsx'
import { SelectionToolbar } from './SelectionToolbar.tsx'
import {
  refreshDirectiveChips,
  watchAnnotationDirectives,
} from './dom/decorateAnnotationDirectives.ts'
import {
  syncPendingAnnotationJobs,
  watchAnnotationMarks,
} from './dom/annotate-text.ts'
import {
  bindLocale,
  DICTIONARIES,
  LANGUAGE_RU,
  LOCALE_NS,
  SHIPPED_DICTS,
  subscribeLocale,
} from './i18n.ts'
import { ensureToolbarStyles } from './styles.ts'
import { UserMessageDisplay } from './transcript/UserMessageDisplay.tsx'
import {
  bindAnnotationSession,
  getAnnotations,
  setAnnotationPersistence,
  subscribeAnnotations,
} from './state/annotation-store.ts'
import { createAnnotationPersistence } from './state/annotation-storage.ts'

/**
 * Browser half of dsh-select-quote.
 *
 * Selection toolbar is root-scoped (`shell.overlay`) so transcript selections
 * are always observed. Annotation summary stays on the session composer.
 *
 * History cards render **inside** the `user` Chat node view, not on a
 * `select-quote` Chat node. `conversation.chat.node` is gated by the shipped
 * `TURN_PROCESS_INDEPENDENT_KINDS` allowlist (system-prompt, user, steering,
 * turn-trigger, turn-process, turn-error, turn-max-tokens, turn-tail): any other
 * kind is classified as a turn-process member and `hidden` when the completed
 * turn's process disclosure is folded — mounted, but invisible. `user` is on
 * that allowlist, so the bubble is the only placement that is reliably visible.
 *
 * Language is the host's decision, never this plugin's: dictionaries go to
 * `ctx.locale`, and `t()` resolves against whatever language the user picked in
 * Settings. Self-detecting from `navigator` would disagree with the host on the
 * desktop shell, where Electron pins the document language (`--lang`) to its own
 * value while the host preference comes through `__DSH_LOCALE__`.
 *
 * `inject` lists only the services this file actually touches. `sessions` used
 * to be declared here without a single `ctx.sessions` read, and a cordis fiber
 * that waits on a service the shell never provides never activates — which
 * surfaces as a cold-boot "renderer boot failed" with no error message. The
 * session id arrives as a slot prop, so the service is not needed.
 */
export const inject = ['slots', 'locale']

export function apply(ctx: Context): void {
  ensureToolbarStyles()

  // Dictionary registrations are owned effects; the fallback chain must end at
  // `en`, and both shipped host locales are required in one typed call.
  ctx.effect(() => ctx.locale.addLanguage(LANGUAGE_RU), 'dsh-select-quote: ru language')
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, SHIPPED_DICTS),
    'dsh-select-quote: dictionaries (zh, en)',
  )
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, LANGUAGE_RU.id, DICTIONARIES.ru),
    'dsh-select-quote: dictionary (ru)',
  )
  bindLocale({
    translate: ctx.locale.bind(LOCALE_NS),
    getActive: () => ctx.locale.getLocale().active,
    getRevision: () => ctx.locale.getSnapshot().revision,
    subscribe: (listener) => ctx.locale.subscribe(listener),
  })
  // Chips are direct DOM rather than React state, so they need their own pass.
  ctx.effect(
    () => subscribeLocale(() => refreshDirectiveChips()),
    'dsh-select-quote: chip language',
  )

  // Assistant replies may echo :dsh-annotation{index="N"}; decorate them as chips.
  ctx.effect(() => watchAnnotationDirectives(), 'dsh-select-quote: annotation directives')
  // Underline + ordinal badges on annotated text; survive transcript re-renders.
  ctx.effect(() => watchAnnotationMarks(), 'dsh-select-quote: annotation marks')
  // Pending annotations mark their source text the moment they are added.
  ctx.effect(() => {
    syncPendingAnnotationJobs(getAnnotations())
    return subscribeAnnotations(() => syncPendingAnnotationJobs(getAnnotations()))
  }, 'dsh-select-quote: pending annotation marks')

  // Pending annotations survive a refresh the way the draft does: the port is
  // the host store when the platform offers it, plain localStorage otherwise.
  ctx.effect(() => {
    const port = createAnnotationPersistence()
    setAnnotationPersistence(port)
    port.prune()
    return () => setAnnotationPersistence(null)
  }, 'dsh-select-quote: annotation persistence')

  // Root: always mounted selection toolbar + comment popover.
  ctx.slots.inject('shell.overlay', () => {
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'select-quote-toolbar',
        order: 100,
      },
      SelectionToolbar,
    )
  })

  // Session: pending annotation summary inside the composer (~1/5 width).
  ctx.slots.inject('conversation.input.overlay', () => {
    ctx.slots.register(
      {
        name: 'conversation.input.overlay',
        id: 'select-quote-card',
        order: 20,
      },
      QuoteCard,
    )
  })

  // Track the active session for the root toolbar (AnnotationPanel also syncs).
  ctx.slots.inject('conversation.input.overlay', () => {
    ctx.slots.register(
      {
        name: 'conversation.input.overlay',
        id: 'select-quote-session-bridge',
        order: 1,
      },
      SessionBridge,
    )
  })

  // History: protocol-stripped user bubbles that carry their own cards.
  ctx.slots.inject('conversation.chat.node', () => {
    ctx.slots.register(
      {
        name: 'conversation.chat.node',
        key: 'user',
        priority: -10,
      },
      UserMessageDisplay,
    )
  })
}

/** Invisible session-scoped bridge that publishes sessionId for the root toolbar. */
function SessionBridge({ sessionId }: { sessionId?: string }): null {
  bindAnnotationSession(sessionId)
  return null
}
