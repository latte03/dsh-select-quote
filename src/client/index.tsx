import type { Context } from '@deepseek-ai/cordis'
import { QuoteCard } from './composer/AnnotationPanel.tsx'
import { SelectionToolbar } from './SelectionToolbar.tsx'
import { setRuntimeSession } from './runtime.ts'
import { watchAnnotationDirectives } from './dom/decorateAnnotationDirectives.ts'
import {
  syncPendingAnnotationJobs,
  watchAnnotationMarks,
} from './dom/annotate-text.ts'
import { ensureToolbarStyles } from './styles.ts'
import { UserMessageDisplay } from './transcript/UserMessageDisplay.tsx'
import { getAnnotations, subscribeAnnotations } from './state/annotation-store.ts'

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
 */
export const inject = ['slots', 'sessions']

export function apply(ctx: Context): void {
  ensureToolbarStyles()
  // Assistant replies may echo :dsh-annotation{index="N"}; decorate them as chips.
  ctx.effect(() => watchAnnotationDirectives(), 'dsh-select-quote: annotation directives')
  // Underline + ordinal badges on annotated text; survive transcript re-renders.
  ctx.effect(() => watchAnnotationMarks(), 'dsh-select-quote: annotation marks')
  // Pending annotations mark their source text the moment they are added.
  ctx.effect(() => {
    syncPendingAnnotationJobs(getAnnotations())
    return subscribeAnnotations(() => syncPendingAnnotationJobs(getAnnotations()))
  }, 'dsh-select-quote: pending annotation marks')

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
  setRuntimeSession(sessionId)
  return null
}
