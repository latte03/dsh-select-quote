/**
 * Probe: a normal Session fork rendered in the right Sidebar.
 *
 * The shipped side question forks through `subagents.startActivation`, which
 * makes the child an addressed subagent: it never enters the normal session
 * list and its composer routes through the subagent manager. This probe keeps
 * the same sidebar shape but uses the ordinary `sessions.fork` + a plain
 * `SessionReference`, then reuses the host's `sidebar.chat.conversation` seat.
 *
 * Experimental branch only: not part of the published plugin.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { showToast } from '../ui/toast.ts'

const ADDRESS_PREFIX = 'dsh-resource://forkchat/session/'
const KIND = 'forkchat-probe'
const TAB_ID = 'dsh-select-quote-fork-probe'
const CHAT_SLOT = 'dsh-select-quote-fork.chat'

interface ForkReference {
  release(): void
}

interface ProbeSessions {
  fork(options: { sessionId: string; increaseTitle?: boolean }): Promise<string>
  retain(id: string, options: { source: string; signal?: AbortSignal }): ForkReference
}

interface ProbeResourceProvider {
  protocol: string
  open(
    address: string,
    context: { signal: AbortSignal },
  ): AsyncIterable<{ ok: true; value: ForkChatResource }>
}

interface ProbeResources {
  register(provider: ProbeResourceProvider): () => void
}

interface ProbeTabDefinition {
  id: string
  kind: string
  patterns?: readonly string[]
  priority?: string
  canOpen?: (address: string) => boolean
  title: (address: string) => string
}

interface ProbeTabRegistry {
  register(definition: ProbeTabDefinition): () => void
}

interface ProbeSidebarRight {
  openResource(address: string, options?: { kind?: string }): void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    resources: ProbeResources
    sidebarRightTabs: ProbeTabRegistry
  }
}

interface ForkChatResource {
  reference: ForkReference
}

interface ForkChatTabProps {
  useResource: (address: string) => {
    status?: string
    failure?: { message?: string }
    value: ForkChatResource | undefined
  }
  useTabInfo: () => { tab: { contentId: string } }
  SessionProvider: ComponentType<{ session: ForkReference; children?: ReactNode }>
  renderSlot: (key: string, owner: object) => ReactNode
}

interface ForkSessionSnapshot {
  blank: boolean
  awaitingFirstTurn: boolean
  running: boolean
  promptAttempted: boolean
  openState: string
}

interface ForkConversationSnapshot {
  activeTargets: { size: number }
}

interface ForkSessionsState {
  byId: Record<string, { blank?: boolean } | undefined>
}

interface ForkChatPanelProps {
  sessionId: string
  useSession: <T>(selector: (value: ForkSessionSnapshot) => T) => T
  useConversation: <T>(selector: (value: ForkConversationSnapshot) => T) => T
  useSessions: <T>(selector: (value: ForkSessionsState) => T) => T
  renderFactorySlot: (
    name: string,
    props: object,
    options?: { slots?: Record<string, ComponentType<Record<string, unknown>>> },
  ) => ReactNode
}

interface ForkTriggerProps {
  sessionId?: string
  locked?: boolean
  sessions: ProbeSessions
  sidebarRight: ProbeSidebarRight
}

function parseForkAddress(address: string): string | undefined {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  if (url.protocol !== 'dsh-resource:' || url.hostname !== 'forkchat') return undefined
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 2 || parts[0] !== 'session') return undefined
  try {
    return decodeURIComponent(parts[1] as string)
  } catch {
    return undefined
  }
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => { resolve() }, { once: true })
  })
}

function forkChatResourceProvider(sessions: ProbeSessions): ProbeResourceProvider {
  return {
    protocol: 'forkchat',
    async *open(address, { signal }) {
      const sessionId = parseForkAddress(address)
      if (sessionId === undefined) throw new Error(`fork probe: invalid address "${address}"`)
      if (signal.aborted) return
      const reference = sessions.retain(sessionId, { source: 'forkChatProbe', signal })
      try {
        yield { ok: true, value: { reference } }
        await waitForAbort(signal)
      } finally {
        reference.release()
      }
    },
  }
}

/** Host chat view fixed to the transcript; mirrors the host's Local View. */
function FixedChatConversationView(props: {
  renderSlot: (key: string, owner: object) => ReactNode
}): ReactNode {
  return <>{props.renderSlot('conversation.session', { view: 'chat' })}</>
}

/**
 * The host's Sidebar chat panel, rebuilt on the public factory seat. The
 * `sidebar.chat.conversation` occupant belongs to ui-subagent's own tab entry,
 * so another tab cannot render it; `conversation.content` is the public,
 * globally available equivalent.
 */
function ForkChatPanel({
  sessionId,
  useSession,
  useConversation,
  useSessions,
  renderFactorySlot,
}: ForkChatPanelProps): ReactNode {
  const session = useSession(value => value)
  const conversation = useConversation(value => value)
  const active = conversation.activeTargets.size > 0
    || (!session.blank && !session.awaitingFirstTurn)
    || session.running
  const shellPhase = active ? 'active' : session.promptAttempted ? 'engaging' : 'blank'
  const summaryBlank = useSessions(state => state.byId[sessionId]?.blank)
  const settling = shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true
  const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
  const phase = settling ? 'settling' : hero ? 'hero' : 'active'
  return renderFactorySlot(
    'conversation.content',
    { variant: 'embedded', phase, hero },
    { slots: { views: FixedChatConversationView as unknown as ComponentType<Record<string, unknown>> } },
  )
}

/**
 * The tab body: a SessionProvider around our own child slot. The occupant is
 * rendered by the slot framework inside the provider, so it receives the
 * fork-scoped standard hooks.
 */
function ForkChatTab({
  useResource,
  useTabInfo,
  SessionProvider,
  renderSlot,
}: ForkChatTabProps): ReactNode {
  const { tab } = useTabInfo()
  const resource = useResource(tab.contentId)
  const reference = resource.value?.reference
  if (reference === undefined) {
    return (
      <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        {`forkchat ${resource.status ?? 'unknown'}${resource.failure?.message ? `\n${resource.failure.message}` : ''}`}
      </div>
    )
  }
  return (
    <div
      data-sidebar-chat=""
      style={{ display: 'flex', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
    >
      <SessionProvider session={reference}>
        {renderSlot(CHAT_SLOT, {})}
      </SessionProvider>
    </div>
  )
}

function ForkTrigger({ sessionId, locked, sessions, sidebarRight }: ForkTriggerProps): ReactNode {
  const [busy, setBusy] = useState(false)
  if (!sessionId) return null
  return (
    <button
      type="button"
      disabled={locked || busy}
      title="Fork this session into the right sidebar (probe)"
      onPointerDown={(event) => { event.stopPropagation() }}
      onClick={() => {
        setBusy(true)
        void sessions
          .fork({ sessionId, increaseTitle: true })
          .then((childId) => {
            sidebarRight.openResource(`${ADDRESS_PREFIX}${encodeURIComponent(childId)}`, { kind: KIND })
          })
          .catch((error: unknown) => {
            showToast(`fork probe: ${error instanceof Error ? error.message : String(error)}`, 4000)
          })
          .finally(() => { setBusy(false) })
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 8px',
        border: '1px solid currentColor',
        borderRadius: 6,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: 12,
        opacity: busy ? 0.5 : 0.75,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      {busy ? 'Forking…' : 'Fork →'}
    </button>
  )
}

function forkTriggerFor(services: {
  sessions: ProbeSessions
  sidebarRight: ProbeSidebarRight
}): ComponentType<{ sessionId?: string; locked?: boolean }> {
  return (props) => <ForkTrigger {...props} {...services} />
}

/** Register the probe resource, tab type, tab body, and composer trigger. */
export function installSidebarForkProbe(ctx: Context): void {
  const sessions = ctx.sessions as unknown as ProbeSessions
  const sidebarRight = ctx.sidebarRight as unknown as ProbeSidebarRight

  ctx.effect(
    () => ctx.resources.register(forkChatResourceProvider(sessions)),
    'dsh-select-quote probe: forkchat resource',
  )
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: KIND,
        patterns: ['dsh-resource://forkchat/**'],
        priority: 'extension',
        canOpen: (address) => parseForkAddress(address) !== undefined,
        title: (address) => {
          const sessionId = parseForkAddress(address)
          return sessionId === undefined ? 'Fork' : `Fork · ${sessionId.slice(0, 8)}`
        },
      }),
    'dsh-select-quote probe: forkchat tab type',
  )
  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register(
      {
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
        children: { [CHAT_SLOT]: { kind: 'single', scope: 'session' } },
      },
      ForkChatTab,
    ),
  )
  ctx.slots.inject(CHAT_SLOT, () =>
    ctx.slots.register({ name: CHAT_SLOT }, ForkChatPanel),
  )
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: `${TAB_ID}-trigger`,
        order: 50,
      },
      forkTriggerFor({ sessions, sidebarRight }),
    ),
  )
}
