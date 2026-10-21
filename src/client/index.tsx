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
import { watchSubmissionEcho } from './dom/stripSubmissionEcho.ts'
import {
  bindLocale,
  DICTIONARIES,
  LANGUAGE_RU,
  LOCALE_NS,
  SHIPPED_DICTS,
  subscribeLocale,
} from './i18n.ts'
import { ensureToolbarStyles } from './styles.ts'
import {
  UserMessageDisplay,
  type HostUserComponent,
  type UserMessageDisplayProps,
} from './transcript/UserMessageDisplay.tsx'
import { pickHostUser } from './transcript/host-user.ts'
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
 * History summary renders **inside** the `user` Chat node view, not on a
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
  // The optimistic send echo paints the composer draft, protocol block included.
  ctx.effect(() => watchSubmissionEcho(), 'dsh-select-quote: submission echo')
  // Pending annotations mark their source text the moment they are added.
  ctx.effect(() => {
    syncPendingAnnotationJobs(getAnnotations())
    return subscribeAnnotations(() => syncPendingAnnotationJobs(getAnnotations()))
  }, 'dsh-select-quote: pending annotation marks')

  // Pending annotations survive a refresh the way the draft does: both live in
  // localStorage, under this plugin's own key prefix.
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

  // History: delegate the bubble to the host's own UserMessageNodeView after
  // rewriting `node.data.content`, then prepend the annotation summary. The host
  // view owns the time/copy actions row, attachments, file cards and reference
  // summaries, so a host change or another plugin's decoration of that row is
  // preserved instead of being shadowed by a private copy.
  // `UserNode` is the registration below; passing it by identity keeps the
  // lookup independent of the priority value used to win the slot election.
  function UserNode(props: UserMessageDisplayProps) {
    return <UserMessageDisplay {...props} hostUserOf={hostUserOf} />
  }
  const hostUserOf = (): HostUserComponent | undefined => {
    const entries =
      typeof ctx.slots.entries === 'function'
        ? ctx.slots.entries('conversation.chat.node')
        : []
    return pickHostUser(entries, UserNode) as HostUserComponent | undefined
  }
  ctx.slots.inject('conversation.chat.node', () => {
    ctx.slots.register(
      {
        name: 'conversation.chat.node',
        key: 'user',
        priority: -10,
        // The delegated host view needs its own translator for the copy
        // tooltip; the chat namespace is the one it is written against.
        locale: 'chat',
      },
      UserNode,
    )
  })
}

/** Invisible session-scoped bridge that publishes sessionId for the root toolbar. */
function SessionBridge({ sessionId }: { sessionId?: string }): null {
  bindAnnotationSession(sessionId)
  return null
}
