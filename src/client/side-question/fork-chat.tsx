/**
 * Right-sidebar presentation of a side-question fork.
 *
 * The child is an ordinary Session, so this tab owns the public chat surface
 * (`conversation.content` in its embedded variant) and keeps the fork out of
 * the catalog with the row marker from `fork-state`. The send flow lives in
 * `runSideQuestion`; this module only owns the tab, resource, and keep action.
 */

import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { t } from '../i18n.ts'
import { showToast } from '../ui/toast.ts'
import {
  forgetHiddenSideFork,
  isHiddenSideFork,
  isKeptSideFork,
  keepSideFork,
  rememberSideFork,
  subscribeSideForkState,
} from './fork-state.ts'
import {
  parseSideForkAddress,
  SIDE_FORK_KIND,
  SIDE_FORK_SLOT,
  SIDE_FORK_TAB_ID,
} from './protocol.ts'

const TAB_PATTERN = 'dsh-resource://select-quote-side/**'
const HIDDEN_ROW_SLOT = 'sidebar.session.row.trailing'

interface SideForkReference {
  release(): void
}

interface SideForkChatResource {
  reference: SideForkReference
}

interface SideForkResourceProvider {
  protocol: string
  open(
    address: string,
    context: { signal: AbortSignal },
  ): AsyncIterable<{ ok: true; value: SideForkChatResource }>
}

interface SideForkTabProps {
  useResource: (address: string) => {
    status?: string
    failure?: { message?: string }
    value: SideForkChatResource | undefined
  }
  useTabInfo: () => { tab: { contentId: string } }
  SessionProvider: ComponentType<{ session: SideForkReference; children?: ReactNode }>
  renderSlot: (key: string, owner: object) => ReactNode
}

interface SideForkPanelProps {
  sessionId: string
  useSession: <T>(selector: (value: SideForkSessionSnapshot) => T) => T
  useConversation: <T>(selector: (value: SideForkConversationSnapshot) => T) => T
  useSessions: <T>(selector: (value: SideForkSessionsState) => T) => T
  renderFactorySlot: (
    name: string,
    props: object,
    options?: { slots?: Record<string, ComponentType<Record<string, unknown>>> },
  ) => ReactNode
}

interface SideForkSessionSnapshot {
  blank: boolean
  awaitingFirstTurn: boolean
  running: boolean
  promptAttempted: boolean
  openState: string
}

interface SideForkConversationSnapshot {
  activeTargets: { size: number }
}

interface SideForkSessionsState {
  byId: Record<string, { blank?: boolean } | undefined>
}

interface HiddenRowProps {
  sessionId?: string
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => { resolve() }, { once: true })
  })
}

function sideForkResourceProvider(
  sessions: Context['sessions'],
  workspace: Context['uiWorkspace'],
  workspaces: Context['workspaces'],
): SideForkResourceProvider {
  return {
    protocol: 'select-quote-side',
    async *open(address, { signal }) {
      const sessionId = parseSideForkAddress(address)
      if (sessionId === undefined) throw new Error(`side question: invalid address "${address}"`)
      if (signal.aborted) return
      // A restored tab may point at a fork archived by the previous close.
      // Kept forks are ordinary listed Sessions and stay visible from the start.
      if (!isKeptSideFork(sessionId)) rememberSideFork(sessionId)
      if ((workspaces.list.getSnapshot().archivedSessionIds ?? []).includes(sessionId)) {
        await workspace.unarchiveSession(sessionId)
      }
      if (signal.aborted) return
      const reference = sessions.retain(sessionId, { source: 'selectQuoteSideChat', signal })
      try {
        yield { ok: true, value: { reference } }
        await waitForAbort(signal)
      } finally {
        reference.release()
        // Keeping the fork promotes it to a normal listed Session; closing the
        // tab must not archive it.
        if (isKeptSideFork(sessionId)) return
        try {
          await workspace.archiveSession(sessionId, { stopActivity: true })
          forgetHiddenSideFork(sessionId)
        } catch (error) {
          // A running turn can refuse the archive. Keep the id hidden so the
          // row stays out of the catalog; opening the tab retries the restore.
          if (sessions.list.getSnapshot().byId[sessionId] === undefined) {
            forgetHiddenSideFork(sessionId)
          } else {
            console.warn('side question: archive on close failed', error)
          }
        }
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
function SideForkPanel({
  sessionId,
  useSession,
  useConversation,
  useSessions,
  renderFactorySlot,
}: SideForkPanelProps): ReactNode {
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
function SideForkTab({
  useResource,
  useTabInfo,
  SessionProvider,
  renderSlot,
}: SideForkTabProps): ReactNode {
  const { tab } = useTabInfo()
  const resource = useResource(tab.contentId)
  const sessionId = parseSideForkAddress(tab.contentId)
  const kept = useSyncExternalStore(
    subscribeSideForkState,
    () => sessionId !== undefined && isKeptSideFork(sessionId),
    () => false,
  )
  const reference = resource.value?.reference
  const body = reference === undefined
    ? (
        <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {`side question ${resource.status ?? 'unknown'}${resource.failure?.message ? `\n${resource.failure.message}` : ''}`}
        </div>
      )
    : (
        <SessionProvider session={reference}>
          {renderSlot(SIDE_FORK_SLOT, {})}
        </SessionProvider>
      )
  return (
    <div
      data-sidebar-chat=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {sessionId !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flex: 'none',
            padding: '2px 8px',
          }}
        >
          <button
            type="button"
            disabled={kept}
            title={t('sideTask.keepHint')}
            onClick={() => {
              keepSideFork(sessionId)
              showToast(t('sideTask.keptToast'), 3000)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 22,
              padding: '0 8px',
              border: '1px solid currentColor',
              borderRadius: 6,
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontSize: 11,
              opacity: kept ? 0.5 : 0.75,
              cursor: kept ? 'default' : 'pointer',
            }}
          >
            {kept ? t('sideTask.kept') : t('sideTask.keep')}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {body}
      </div>
    </div>
  )
}

/**
 * Marker for one catalog row. The host-layer CSS hides the row that contains
 * it; the Session itself stays writable and keeps running.
 */
function HiddenSideForkRowMarker({ sessionId }: HiddenRowProps): ReactNode {
  const hidden = useSyncExternalStore(
    subscribeSideForkState,
    () => sessionId !== undefined && isHiddenSideFork(sessionId),
    () => false,
  )
  return hidden ? <span data-dsq-hidden-fork="" hidden /> : null
}

/** Register the fork resource, tab type, native chat body, and row marker. */
export function installSideForkChat(ctx: Context): void {
  const sessions = ctx.sessions
  const workspace = ctx.uiWorkspace
  const workspaces = ctx.workspaces

  ctx.effect(
    () => ctx.resources.register(sideForkResourceProvider(sessions, workspace, workspaces)),
    'dsh-select-quote: side fork resource',
  )
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: SIDE_FORK_TAB_ID,
        kind: SIDE_FORK_KIND,
        patterns: [TAB_PATTERN],
        priority: 'extension',
        keepMounted: true,
        canOpen: (address) => parseSideForkAddress(address) !== undefined,
        title: (address) => {
          const sessionId = parseSideForkAddress(address)
          if (sessionId === undefined) return t('sideTask.title')
          const summary = sessions.list.getSnapshot().byId[sessionId]
          return summary?.displayTitle?.trim() || summary?.title?.trim() || t('sideTask.title')
        },
      }),
    'dsh-select-quote: side fork tab type',
  )
  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register(
      {
        name: 'sidebar.right.pane.tab',
        key: SIDE_FORK_TAB_ID,
        children: { [SIDE_FORK_SLOT]: { kind: 'single', scope: 'session' } },
      },
      SideForkTab,
    ),
  )
  ctx.slots.inject(SIDE_FORK_SLOT, () =>
    ctx.slots.register({ name: SIDE_FORK_SLOT }, SideForkPanel),
  )
  ctx.slots.inject(HIDDEN_ROW_SLOT, () =>
    ctx.slots.register(
      {
        name: HIDDEN_ROW_SLOT,
        id: 'dsh-select-quote-side-row',
        order: 100,
      },
      HiddenSideForkRowMarker,
    ),
  )
}
