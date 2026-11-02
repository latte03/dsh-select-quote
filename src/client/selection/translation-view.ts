import type { TranslateLanguage } from '../translate.ts'

/** One translation attempt as the popover paints it. */
export interface TranslationState {
  readonly status: 'pending' | 'done' | 'error' | 'tooLong' | 'unavailable'
  /** Whole translation so far; present while streaming and after success. */
  readonly text?: string
  /** Model reasoning so far, when the route keeps thinking enabled. */
  readonly reasoning?: string
  /** The route could not disable reasoning, so the model is still thinking. */
  readonly thinking?: boolean
  /** Host failure text shown under the retry hint (full detail stays in the log). */
  readonly error?: string
}

/** Handlers and state the paint-only toolbar needs for the translate phase. */
export interface TranslationActions {
  readonly target: TranslateLanguage
  readonly state: TranslationState
  readonly copied: boolean
  onTarget(target: TranslateLanguage): void
  onCopy(): void
  onRetry(): void
  onStop(): void
  onClose(): void
}
