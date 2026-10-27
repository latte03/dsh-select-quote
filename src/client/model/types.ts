/** Model catalog faces shared by the picker and the side-task bridge. */

/** One provider/model route; an omitted effort means the model's default. */
export interface ModelChoice {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

export interface ModelEffort {
  readonly id: string
  readonly name: string
}

export interface ModelReasoning {
  readonly defaultEffort?: string
  readonly efforts: readonly ModelEffort[]
}

export interface ModelEntry {
  readonly id: string
  readonly name: string
  readonly reasoning?: ModelReasoning
}

export interface ModelGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly ModelEntry[]
}

export interface ModelGroupFailure {
  readonly id: string
  readonly name: string
  readonly message: string
}

export type ModelCatalogStatus = 'idle' | 'loading' | 'ready' | 'error' | 'selecting'

/** The shared per-session directory snapshot (`@deepseek-ai/dsh-client-ui-model-selection`). */
export interface ModelCatalogSnapshot {
  readonly current: ModelChoice | null
  readonly retainedEffort?: string
  readonly groups: readonly ModelGroup[]
  readonly failures: readonly ModelGroupFailure[]
  readonly status: ModelCatalogStatus
  readonly pending: ModelChoice | null
  readonly error: string | null
}

/**
 * The read-only slice of one session directory the picker needs.
 *
 * Selection is deliberately absent: the side task overrides its child model,
 * it never switches the main conversation's route.
 */
export interface ModelDirectoryFace {
  readonly store: {
    getSnapshot(): ModelCatalogSnapshot
    subscribe(listener: () => void): () => void
  }
  load(): Promise<unknown>
}
