/**
 * Shared runtime handles across slot scopes.
 *
 * The selection toolbar mounts at root (`shell.overlay`) while the annotation
 * panel is session-scoped, so both sides read one partition keyed by the
 * session the host minted for the active composer.
 *
 * The Host shortcut commands live in `apply()`, outside React, and need a way
 * back into the mounted toolbar; that bridge is published here as well.
 */
import type { SelectionSnapshot } from './dom/selection.ts'
import type { ModelChoice, ModelDirectoryFace, ModelGroup } from './model/types.ts'
import type { TranslateLanguage } from './translate.ts'
import type { TranslateStreamEvent } from '../shared/plugin-remote.ts'

export type SelectionBridgeState = 'ready' | 'no-selection' | 'busy'

export interface SelectionBridge {
  /** Whether a keyboard command can act right now, and why not. */
  state(): SelectionBridgeState
  /** Open the menu beside the selection, if it is still there. */
  open(): void
  /** Save the selection as an annotation and open its comment step. */
  add(): void
}

export const runtime: {
  sessionId?: string
  selection?: SelectionBridge
  /**
   * Opens a fork-backed side task for one latched selection and question.
   * `model` overrides the child's route; `null` follows the main conversation.
   */
  sideTask?: (
    snapshot: SelectionSnapshot,
    question: string,
    model: ModelChoice | null,
  ) => Promise<void>
  /**
   * Stream one translation for a latched selection into `target`.
   *
   * Published only once the Remote group and the Host model service are both
   * live; when absent the toolbar offers a clear "unavailable" state instead
   * of a button that never answers. Events carry whole text snapshots, never
   * deltas, so a late frame can replace the painted result safely.
   */
  translate?: (
    snapshot: SelectionSnapshot,
    target: TranslateLanguage,
    signal: AbortSignal,
    onEvent: (event: TranslateStreamEvent) => void,
  ) => Promise<void>
  /**
   * Read-only model directory face for a live session.
   *
   * Published by the `modelDirectories` injection; absent when the shell has no
   * model-selection plugin, in which case the picker is simply not offered.
   */
  modelDirectoryFor?: (sessionId: string) => ModelDirectoryFace | undefined
  /**
   * Host-generation model catalog, not tied to a session. The settings page uses
   * it to offer the same routes as the composer's model menu.
   */
  modelCatalog?: () => Promise<readonly ModelGroup[]>
  /** Write one live config field (the translation language menu persists its pick). */
  setConfigField?: (field: string, value: unknown) => void
  /**
   * Whether a session belongs to a subagent conversation.
   *
   * A sidebar subagent chat mounts the same composer overlay for its own child
   * session; treating that child as the active session would retarget the root
   * toolbar and make the next side task fork from a subagent session, which the
   * host rejects ("owned by subagent routing").
   */
  isSubagentSession?: (sessionId: string) => boolean
} = {}

export function setRuntimeSession(sessionId: string | undefined): void {
  if (sessionId) runtime.sessionId = sessionId
}
