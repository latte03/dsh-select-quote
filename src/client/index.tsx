import type { Context } from '@deepseek-ai/cordis'
import { QuoteCard } from './composer/AnnotationPanel.tsx'
import { attachConfigForm, getConfig } from './config.ts'
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
import { composeQuotedMessage, previewTitle } from './protocol/annotation-protocol.ts'
import {
  bindLocale,
  DICTIONARIES,
  LANGUAGE_RU,
  LOCALE_NS,
  SHIPPED_DICTS,
  subscribeLocale,
  t,
} from './i18n.ts'
import sideTaskRemote from './remote.ts'
import { ensureToolbarStyles } from './styles.ts'
import type { SelectionSnapshot } from './dom/selection.ts'
import type { ModelChoice } from './model/types.ts'
import { runtime } from './runtime.ts'
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

/** Shape of the dynamic `remote.selectQuoteSideTask` namespace service. */
interface SideTaskRemoteApi {
  create(
    agentId: string,
    request: { prompt: string; label?: string; model?: ModelChoice },
  ): Promise<
    | { ok: true; value: { childId: string } }
    | { ok: false; error: { message: string } }
  >
}

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

  // Tell the session bridge which sessions are subagent conversations. A
  // sidebar chat mounts this plugin's composer overlay for the child session;
  // binding that child would point the root toolbar (and the side-task parent)
  // at a session the host refuses to fork ("owned by subagent routing").
  ctx.inject(['sessions'], (scope) => {
    runtime.isSubagentSession = (sessionId) =>
      scope.sessions.list.getSnapshot().byId[sessionId]?.origin === 'subagent'
    scope.effect(
      () => () => {
        delete runtime.isSubagentSession
      },
      'dsh-select-quote: subagent session guard',
    )
  })

  // Read face of the model catalog for the side-task picker. The directory is
  // cached per session and unknown sessions throw, so a stale id just means no
  // picker this time; selection itself stays local (the child gets the choice
  // through agentOptions instead of switching this session's route).
  ctx.inject(['modelDirectories'], (scope) => {
    runtime.modelDirectoryFor = (sessionId) => {
      try {
        const directory = scope.modelDirectories.directoryFor(sessionId)
        return { store: directory.store, load: () => directory.load() }
      } catch {
        return undefined
      }
    }
    scope.effect(
      () => () => {
        delete runtime.modelDirectoryFor
      },
      'dsh-select-quote: model catalog',
    )
  })

  /**
   * Side task: the browser mounts the Host's Remote descriptor group, then a
   * toolbar click asks the Host to start a fork-backed subagent for the live
   * session. Only the Host can create one, and only a subagent session carries
   * `origin: "subagent"` — which is what keeps it out of the ordinary list.
   *
   * `$mount` installs the namespace as its own dynamic service
   * (`remote.<namespace>`); the mount callback reads it back by that key, so
   * the entry point only exists once the namespace is actually callable.
   */
  ctx.inject(['remote', 'sidebarRight'], (scope) => {
    scope.effect(() => {
      let dispose: (() => Promise<void>) | undefined
      let stopped = false
      let published:
        | ((
            snapshot: SelectionSnapshot,
            question: string,
            model: ModelChoice | null,
          ) => Promise<void>)
        | undefined

      const publish = (): void => {
        const api = scope.get('remote.selectQuoteSideTask') as SideTaskRemoteApi | undefined
        if (api === undefined) return

        const openSideTask = async (
          snapshot: SelectionSnapshot,
          question: string,
          model: ModelChoice | null,
        ): Promise<void> => {
          const sessionId = runtime.sessionId
          if (!sessionId) throw new Error('no active session')
          // Same wire format as the main conversation: the Host copies the
          // prompt into the child's transcript, so the quote must be a parsed
          // annotation block there, not prose the user never typed.
          const source = snapshot.source
          const prompt = composeQuotedMessage(question, {
            text: snapshot.text,
            ...(source === undefined
              ? {}
              : {
                  source: {
                    text: snapshot.text,
                    messageId: source.messageId,
                    messageKind: source.messageKind,
                    startOffset: source.startOffset,
                    endOffset: source.endOffset,
                  },
                }),
          })
          // The Host uses this label for both the sidebar tab title and the
          // parent's subagent catalog row, so repeated side questions stay
          // distinguishable without opening each child.
          const excerpt = previewTitle(question, 24)
          const label = excerpt ? `${t('toolbar.askInSide')} · ${excerpt}` : t('toolbar.askInSide')
          // The mounted namespace returns the gateway envelope; the child id
          // only exists inside `value`.
          // Reuse mode keeps one side child per main session, so it has no
          // per-question route choice: the child keeps the model it was born
          // with (the parent's, unless the first question overrode it).
          const reuse = getConfig().sideTaskMode === 'reuse'
          const outcome = await api.create(sessionId, {
            label,
            prompt,
            ...(reuse ? { reuse: true } : model === null ? {} : { model }),
          })
          if (!outcome.ok) throw new Error(outcome.error.message)
          const { childId } = outcome.value
          const address = `dsh-resource://subagentchat/session/${encodeURIComponent(childId)}?parent=${encodeURIComponent(sessionId)}&mode=continuable`
          scope.sidebarRight.openResource(address, { kind: 'subagentchat' })
        }

        published = openSideTask
        runtime.sideTask = openSideTask
      }

      void scope.remote.$mount(sideTaskRemote).then(
        (value) => {
          if (stopped) {
            void value()
            return
          }
          dispose = value
          publish()
        },
        (error) => {
          console.error('dsh-select-quote: side task remote mount failed', error)
        },
      )

      return () => {
        stopped = true
        if (published !== undefined && runtime.sideTask === published) delete runtime.sideTask
        if (dispose) void dispose()
      }
    }, 'dsh-select-quote: side task remote')
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
