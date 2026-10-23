import type { Context } from '@deepseek-ai/cordis'
import { QuoteCard } from './composer/AnnotationPanel.tsx'
import { attachConfigForm } from './config.ts'
import { SelectionToolbar } from './selection/SelectionToolbar.tsx'
import { ConfigRow } from './settings/ConfigRow.tsx'
import { installSelectionShortcut } from './shortcut-menu.ts'
import { PACKAGE_NAME, ROW_ID } from '../shared/identity.ts'
import {
  refreshDirectiveChips,
  watchAnnotationDirectives,
} from './dom/decorateAnnotationDirectives.ts'
import {
  refreshAnnotationMarkLabels,
  syncPendingAnnotationJobs,
  watchAnnotationMarks,
} from './dom/annotate-text.ts'
import { bindAnnotationMarkPreview } from './dom/chipPreview.ts'
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
  type HostNodeComponent,
  type UserMessageDisplayProps,
} from './transcript/UserMessageDisplay.tsx'
import { pickHostNode } from './transcript/host-user.ts'
import {
  adoptStorageAnnotations,
  bindAnnotationSession,
  getAnnotations,
  setAnnotationPersistence,
  subscribeAnnotations,
} from './state/annotation-store.ts'
import { createAnnotationPersistence } from './state/annotation-storage.ts'
import { sessionIdOfKey } from './state/annotation-persistence.ts'

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
    () =>
      subscribeLocale(() => {
        refreshDirectiveChips()
        refreshAnnotationMarkLabels()
      }),
    'dsh-select-quote: chip language',
  )

  // Settings are owned by the Host. The service is optional on purpose: a
  // shell without it must still activate on defaults instead of waiting
  // forever (the top-level `inject` list is only for services this file
  // genuinely cannot run without).
  ctx.inject(['configForms'], (scope) => {
    scope.effect(
      () => attachConfigForm(scope.configForms.get(ROW_ID)),
      'dsh-select-quote: config',
    )
    // Configuration is a bundle-level section, not a row page: the Plugins page
    // renders it directly on the package's outer page (between the description
    // and the rows), so there is no extra "configure" step to reach it. The
    // bundle slot is keyed by the package name; `whileServed` still ties the
    // section to the row's describe mirror, so an unserved row leaves no
    // half-alive form behind.
    const form = scope.configForms.get(ROW_ID)
    scope.effect(
      () =>
        scope.configForms.whileServed([ROW_ID], () =>
          scope.slots.inject('plugins.bundle.config', () =>
            scope.slots.register(
              {
                name: 'plugins.bundle.config',
                key: PACKAGE_NAME,
                locale: LOCALE_NS,
                inject: () => ({ form }),
              },
              ConfigRow,
            ),
          ),
        ),
      'dsh-select-quote: settings section',
    )
  })

  // The keyboard entry is its own service, also optional: a shell without the
  // shortcut registry still gets the toolbar and the right-click menu.
  ctx.inject(['shortcuts'], (scope) => {
    installSelectionShortcut(scope)
  })

  // Assistant replies may echo :dsh-annotation{index="N"}; decorate them as chips.
  ctx.effect(() => watchAnnotationDirectives(), 'dsh-select-quote: annotation directives')
  // Underline + ordinal badges on annotated text; survive transcript re-renders.
  ctx.effect(() => watchAnnotationMarks(), 'dsh-select-quote: annotation marks')
  // Click/keyboard preview for those marks (the same panel as model chips).
  ctx.effect(() => bindAnnotationMarkPreview(), 'dsh-select-quote: mark preview')
  // The optimistic send echo paints the composer draft, protocol block included.
  ctx.effect(() => watchSubmissionEcho(), 'dsh-select-quote: submission echo')
  // Pending annotations mark their source text the moment they are added.
  ctx.effect(() => {
    syncPendingAnnotationJobs(getAnnotations())
    return subscribeAnnotations(() => syncPendingAnnotationJobs(getAnnotations()))
  }, 'dsh-select-quote: pending annotation marks')

  // Pending annotations survive a refresh the way the draft does: both live in
  // localStorage, under this plugin's own key prefix. A `storage` event means
  // another tab wrote (or cleared) one of those keys; re-read it before this
  // tab's next edit can overwrite the newer state with its stale array.
  ctx.effect(() => {
    const port = createAnnotationPersistence()
    setAnnotationPersistence(port)
    port.prune()
    const onStorage = (event: StorageEvent): void => {
      if (event.storageArea !== null && event.storageArea !== window.localStorage) return
      if (event.key === null) {
        adoptStorageAnnotations(null)
        return
      }
      const sessionId = sessionIdOfKey(event.key)
      if (sessionId !== null) adoptStorageAnnotations(sessionId)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      setAnnotationPersistence(null)
    }
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
  //
  // `steering` is the same host bubble registered under another key; a
  // steering send carries the same protocol block, so it needs the same
  // rewrite. Each wrapper passes itself by identity so the lookup never
  // resolves the plugin's own registration as the host.
  const hostNodeOf = (
    key: 'user' | 'steering',
    self: unknown,
  ): HostNodeComponent | undefined => {
    const entries =
      typeof ctx.slots.entries === 'function'
        ? ctx.slots.entries('conversation.chat.node')
        : []
    return pickHostNode(entries, self, key) as HostNodeComponent | undefined
  }
  function UserNode(props: UserMessageDisplayProps) {
    return <UserMessageDisplay {...props} hostNodeOf={() => hostNodeOf('user', UserNode)} />
  }
  function SteeringNode(props: UserMessageDisplayProps) {
    return (
      <UserMessageDisplay {...props} hostNodeOf={() => hostNodeOf('steering', SteeringNode)} />
    )
  }
  for (const [key, View] of [
    ['user', UserNode],
    ['steering', SteeringNode],
  ] as const) {
    ctx.slots.inject('conversation.chat.node', () => {
      ctx.slots.register(
        {
          name: 'conversation.chat.node',
          key,
          priority: -10,
          // The delegated host view needs its own translator for the copy
          // tooltip; the chat namespace is the one it is written against.
          locale: 'chat',
        },
        View,
      )
    })
  }
}

/** Invisible session-scoped bridge that publishes sessionId for the root toolbar. */
function SessionBridge({ sessionId }: { sessionId?: string }): null {
  bindAnnotationSession(sessionId)
  return null
}
