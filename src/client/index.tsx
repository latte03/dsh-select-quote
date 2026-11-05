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
  syncHandoffMarks,
  syncPendingAnnotationJobs,
  watchAnnotationMarks,
} from './dom/annotate-text.ts'
import { bindAnnotationMarkPreview } from './dom/chipPreview.ts'
import { watchSubmissionEcho } from './dom/stripSubmissionEcho.ts'
import { composeQuotedMessage, previewTitle } from './protocol/annotation-protocol.ts'
import {
  bindLocale,
  DICTIONARIES,
  LOCALE_NS,
  OPTIONAL_LANGUAGES,
  SHIPPED_DICTS,
  subscribeLocale,
  t,
} from './i18n.ts'
import pluginRemote from './remote.ts'
import type { TranslateStreamEvent } from '../shared/plugin-remote.ts'
import { ensureToolbarStyles } from './styles.ts'
import type { SelectionSnapshot } from './dom/selection.ts'
import type { ModelChoice, ModelGroup } from './model/types.ts'
import { runtime, setHandoffHost } from './runtime.ts'
import {
  MAX_TRANSLATE_CHARS,
  resolveTranslatePrompt,
  type TranslateLanguage,
} from './translate.ts'
import {
  UserMessageDisplay,
  type HostNodeComponent,
  type UserMessageDisplayProps,
} from './transcript/UserMessageDisplay.tsx'
import { componentName, pickHostNode } from './transcript/host-user.ts'
import { createProtocolRule } from './transcript/protocol-rule.ts'
import {
  adoptStorageAnnotations,
  bindAnnotationSession,
  getAnnotations,
  getOutbound,
  reconcileHandoffs,
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

/** Shape of the dynamic `remote.selectQuoteTranslate` namespace service. */
interface TranslateRemoteApi {
  translate(
    agentId: string,
    request: {
      text: string
      target: string
      prompt: string
      provider?: string
      model?: string
    },
    signal?: AbortSignal,
  ): AsyncIterable<unknown>
}

/** The right sidebar's resource entry point. */
interface SidebarRightApi {
  openResource(address: string, options: { kind: string }): void
}

/** The Host-generation model catalog, not tied to one session. */
interface SessionCatalogApi {
  modelCatalog(): Promise<
    | {
        ok: true
        value: {
          groups: readonly {
            id: string
            name: string
            models: readonly {
              id: string
              name: string
              reasoning?: ModelGroup['models'][number]['reasoning']
            }[]
          }[]
        }
      }
    | { ok: false; error: { message: string } }
  >
}

export function apply(ctx: Context): void {
  ensureToolbarStyles()

  // Dictionary registrations are owned effects; the fallback chain must end at
  // `en`, and both shipped host locales are required in one typed call.
  //
  // The language definitions belong to the Host: dsh 0.2.2-alpha.2 ships a
  // built-in catalog (ja/es/fr/de/ru/pt), and `addLanguage` throws on a
  // duplicate id — an unconditional call turns this plugin's whole fiber into
  // `failed`, which the web boot audit reports as "1 entry did not activate"
  // and blocks the GUI. Add a pack only where the Host does not offer it;
  // dictionaries are registered either way.
  const hostLanguageIds = new Set(
    ctx.locale.getSnapshot().locales.map((language) => language.id.toLowerCase()),
  )
  for (const language of OPTIONAL_LANGUAGES) {
    if (hostLanguageIds.has(language.id)) continue
    ctx.effect(
      () => ctx.locale.addLanguage(language),
      `dsh-select-quote: ${language.id} language`,
    )
  }
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, SHIPPED_DICTS),
    'dsh-select-quote: dictionaries (zh, en)',
  )
  for (const language of OPTIONAL_LANGUAGES) {
    ctx.effect(
      () => ctx.locale.register(LOCALE_NS, language.id, DICTIONARIES[language.id]),
      `dsh-select-quote: dictionary (${language.id})`,
    )
  }
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
    // The translation language menu lives in the selection overlay, outside the
    // settings slot, but must persist through the same form so both surfaces
    // show one value.
    const setField = (field: string, value: unknown): void => {
      void form.set(field, value)
    }
    runtime.setConfigField = setField
    scope.effect(
      () => () => {
        if (runtime.setConfigField === setField) delete runtime.setConfigField
      },
      'dsh-select-quote: config writer',
    )
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

  // Cross-session handoff. All three services must exist: navigation
  // (`uiWorkspace.openSession`), the workspace catalog (grouping + archived
  // state) and `sessions.create` (the "new session" target). A host without
  // them simply never publishes the bridge, and the toolbar hides the action —
  // the plugin still activates, which is the whole point of feature detection.
  ctx.inject(['sessions', 'workspaces', 'uiWorkspace'], (scope) => {
    const can =
      typeof scope.sessions.create === 'function' &&
      typeof scope.sessions.list?.getSnapshot === 'function' &&
      typeof scope.sessions.list.subscribe === 'function' &&
      typeof scope.workspaces.list?.getSnapshot === 'function' &&
      typeof scope.workspaces.list.subscribe === 'function' &&
      typeof scope.uiWorkspace.openSession === 'function'
    if (!can) return
    const host = {
      sessionsSnapshot: () => scope.sessions.list.getSnapshot(),
      subscribeSessions: (listener: () => void) => scope.sessions.list.subscribe?.(listener) ?? (() => {}),
      workspacesSnapshot: () => scope.workspaces.list.getSnapshot(),
      subscribeWorkspaces: (listener: () => void) =>
        scope.workspaces.list.subscribe?.(listener) ?? (() => {}),
      openSession: (sessionId: string) => scope.uiWorkspace.openSession(sessionId),
      createSession: async (request: { workspaceId?: string; cwd?: string }) =>
        scope.sessions.create(request),
    }
    setHandoffHost(host)
    scope.effect(
      () => () => {
        if (runtime.handoffHost === host) setHandoffHost(undefined)
      },
      'dsh-select-quote: handoff host',
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

  // The settings page has no session, so its translation-model picker reads the
  // Host-generation catalog instead. The namespace is resolved lazily: the
  // session remote may mount after this plugin activates.
  ctx.inject(['remote'], (scope) => {
    runtime.modelCatalog = async () => {
      const api = scope.get('remote.session') as SessionCatalogApi | undefined
      if (api === undefined) throw new Error('the model catalog is unavailable')
      const outcome = await api.modelCatalog()
      if (!outcome.ok) throw new Error(outcome.error.message)
      return outcome.value.groups.map((group) => ({
        id: group.id,
        name: group.name,
        models: group.models,
      }))
    }
    scope.effect(
      () => () => {
        delete runtime.modelCatalog
      },
      'dsh-select-quote: global model catalog',
    )
  })

  /**
   * Side task and translation share one Remote descriptor group. The side task
   * asks the Host to start a fork-backed subagent for the live session; the
   * translation runs one direct model call with no conversation context. Only a
   * subagent session carries `origin: "subagent"` — which is what keeps it out
   * of the ordinary list.
   *
   * `$mount` installs each namespace as its own dynamic service
   * (`remote.<namespace>`); the mount callback reads them back by that key, so
   * each entry point only exists once its namespace is actually callable.
   */
  ctx.inject(['remote'], (scope) => {
    scope.effect(() => {
      let dispose: (() => Promise<void>) | undefined
      let stopped = false
      let publishedSide:
        | ((
            snapshot: SelectionSnapshot,
            question: string,
            model: ModelChoice | null,
          ) => Promise<void>)
        | undefined
      let publishedTranslate:
        | ((
            snapshot: SelectionSnapshot,
            target: TranslateLanguage,
            signal: AbortSignal,
            onEvent: (event: TranslateStreamEvent) => void,
          ) => Promise<void>)
        | undefined

      const publish = (): void => {
        const api = scope.get('remote.selectQuoteSideTask') as SideTaskRemoteApi | undefined
        // Resolved at publish time: the mount resolves asynchronously, so a
        // service that activates just after this plugin is already visible.
        const sidebar = scope.get('sidebarRight') as SidebarRightApi | undefined
        if (api !== undefined && sidebar !== undefined) {
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
            const label = excerpt
              ? `${t('toolbar.askInSide')} · ${excerpt}`
              : t('toolbar.askInSide')
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
            sidebar.openResource(address, { kind: 'subagentchat' })
          }

          publishedSide = openSideTask
          runtime.sideTask = openSideTask
        }

        const translateApi = scope.get('remote.selectQuoteTranslate') as
          | TranslateRemoteApi
          | undefined
        if (translateApi !== undefined) {
          const translate = async (
            snapshot: SelectionSnapshot,
            target: TranslateLanguage,
            signal: AbortSignal,
            onEvent: (event: TranslateStreamEvent) => void,
          ): Promise<void> => {
            const sessionId = runtime.sessionId
            if (!sessionId) throw new Error('no active session')
            if (snapshot.text.length > MAX_TRANSLATE_CHARS) {
              throw new Error(`the selection exceeds ${MAX_TRANSLATE_CHARS} characters`)
            }
            const config = getConfig()
            const provider = config.translateProvider.trim()
            const model = config.translateModel.trim()
            const stream = translateApi.translate(
              sessionId,
              {
                text: snapshot.text,
                target,
                prompt: resolveTranslatePrompt(config.translatePrompt, target),
                ...(provider.length > 0 && model.length > 0 ? { provider, model } : {}),
              },
              signal,
            )
            let finished = false
            try {
              for await (const frame of stream) {
                if (signal.aborted) break
                if (typeof frame !== 'object' || frame === null) continue
                const record = frame as Record<string, unknown>
                if (record.type === 'thinking') {
                  onEvent({ type: 'thinking', active: record.active === true })
                } else if (record.type === 'reasoning' && typeof record.text === 'string') {
                  onEvent({ type: 'reasoning', text: record.text })
                } else if (record.type === 'text' && typeof record.text === 'string') {
                  onEvent({ type: 'text', text: record.text })
                } else if (record.type === 'done' && typeof record.text === 'string') {
                  finished = true
                  onEvent({ type: 'done', text: record.text })
                }
              }
            } finally {
              // Closing the handle sends the Gateway's stream cancel, which
              // aborts the host call even when the toolbar stopped early.
              ;(stream as { dispose?: () => void }).dispose?.()
            }
            if (signal.aborted) return
            if (!finished) throw new Error('the translation stream ended without a result')
          }

          publishedTranslate = translate
          runtime.translate = translate
        }
      }

      void scope.remote.$mount(pluginRemote).then(
        (value) => {
          if (stopped) {
            void value()
            return
          }
          dispose = value
          publish()
        },
        (error) => {
          console.error('dsh-select-quote: plugin remote mount failed', error)
        },
      )

      return () => {
        stopped = true
        if (publishedSide !== undefined && runtime.sideTask === publishedSide) {
          delete runtime.sideTask
        }
        if (publishedTranslate !== undefined && runtime.translate === publishedTranslate) {
          delete runtime.translate
        }
        if (dispose) void dispose()
      }
    }, 'dsh-select-quote: plugin remote')
  })

  // Assistant replies may echo :dsh-annotation{index="N"}; decorate them as chips.
  ctx.effect(() => watchAnnotationDirectives(), 'dsh-select-quote: annotation directives')
  // Underline + ordinal badges on annotated text; survive transcript re-renders.
  ctx.effect(() => watchAnnotationMarks(), 'dsh-select-quote: annotation marks')
  // Click/keyboard preview for those marks (the same panel as model chips).
  ctx.effect(() => bindAnnotationMarkPreview(), 'dsh-select-quote: mark preview')
  // The optimistic send echo paints the composer draft, protocol block included.
  ctx.effect(() => watchSubmissionEcho(), 'dsh-select-quote: submission echo')
  // Pending annotations mark their source text the moment they are added, and
  // outbound handoff records draw the single arrow mark of their selection.
  ctx.effect(() => {
    const sync = (): void => {
      syncPendingAnnotationJobs(getAnnotations())
      syncHandoffMarks(getOutbound())
    }
    sync()
    return subscribeAnnotations(sync)
  }, 'dsh-select-quote: pending annotation marks')

  // Pending annotations survive a refresh the way the draft does: both live in
  // localStorage, under this plugin's own key prefix. A `storage` event means
  // another tab wrote (or cleared) one of those keys; re-read it before this
  // tab's next edit can overwrite the newer state with its stale array.
  ctx.effect(() => {
    const port = createAnnotationPersistence()
    setAnnotationPersistence(port)
    port.prune()
    // Startup is one of the reconciliation points: a previous page may have
    // been closed between writing the target item and the source record.
    reconcileHandoffs()
    const onStorage = (event: StorageEvent): void => {
      if (event.storageArea !== null && event.storageArea !== window.localStorage) return
      if (event.key === null) {
        adoptStorageAnnotations(null)
      } else {
        const sessionId = sessionIdOfKey(event.key)
        if (sessionId !== null) adoptStorageAnnotations(sessionId)
      }
      // `adoptStorageAnnotations` reconciles the sessions it holds; a key for
      // an uncached partition still needs the global pair check.
      reconcileHandoffs()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      setAnnotationPersistence(null)
    }
  }, 'dsh-select-quote: annotation persistence')

  // The selection toolbar above is ours end-to-end, but the durable bubble is
  // no longer ours to rewrite on dsh 0.2.2: the host renders user text through
  // `conversation.user.text` -> `uiConversation.userText` rules, and any text
  // no rule claims paints literally. That is why a annotated message used to
  // show its whole JSON payload in the bubble. Claim the protocol span here so
  // it renders as nothing on both host generations.
  //
  // Optional service: a 0.2.1 host has no rule registry at all, and the
  // `priority: -10` `conversation.chat.node` override below still covers it.
  ctx.inject(['uiConversation'], (scope) => {
    const rules = scope.uiConversation?.userText
    if (typeof rules?.register !== 'function') return
    scope.effect(() => rules.register(createProtocolRule()), 'dsh-select-quote: user-text rule')
  })

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
  /** Keys whose resolution failure was already reported (one console line each). */
  const diagnosed = new Set<string>()
  const hostNodeOf = (
    key: 'user' | 'steering',
    self: unknown,
  ): HostNodeComponent | undefined => {
    const entries =
      typeof ctx.slots.entries === 'function'
        ? ctx.slots.entries('conversation.chat.node')
        : []
    const picked = pickHostNode(entries, self, key) as HostNodeComponent | undefined
    if (picked === undefined) {
      // One-shot diagnostic: the fallback bubble has no actions row, so a
      // resolution failure shows up as "the message lost its time/copy row".
      // Print the registry shape once per key so the cause is visible without a
      // debugger.
      if (!diagnosed.has(key)) {
        diagnosed.add(key)
        const nameOf = (component: unknown): string | undefined => componentName(component)
        console.warn(
          `dsh-select-quote: no host view resolved for conversation.chat.node / ${key}`,
          entries.map((entry) => ({
            key: entry.options?.key,
            priority: entry.options?.priority,
            name: nameOf(entry.component),
            self: entry.component === self,
          })),
        )
      }
    }
    return picked
  }

  /**
   * Slot declarations that travel with the winning entry.
   *
   * dsh 0.2.2 renders the user bubble through `conversation.chat.user.before`
   * and `conversation.chat.user.content`, and the slot core asserts that the
   * *entry* declares a nested slot before the entry may render it: a
   * `renderSlot(key)` from an entry whose `children` omits `key` throws
   * `SlotOwnershipError` instead of falling back. The host's own registration
   * carries these declarations, so a wrapper that wins the cell by `priority`
   * must re-declare them or the delegated host view blows up inside the
   * entry's error boundary — and the message renders without its actions row.
   *
   * Exactly what the host declares, no more: `conversation.chat.user.before`
   * is the chain `UserStyleBubble` renders above the bubble. The text/content
   * seats are *factory* slots (`conversation.chat.user.content`,
   * `conversation.user.text`) whose ownership lives on the factory definition,
   * so declaring them here would be a false claim about this entry.
   */
  const HOST_BUBBLE_CHILDREN = {
    'conversation.chat.user.before': { kind: 'chain', scope: 'session' },
  } as const

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
          children: HOST_BUBBLE_CHILDREN,
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
