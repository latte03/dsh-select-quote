/**
 * The Host decorates one official Flash entry with a fixed release tag through
 * its `conversation.input.model.label` slot, owned by
 * `@deepseek-ai/dsh-client-ui-deepseek-model-label-1017`. A plugin cannot
 * render a Host slot, so the picker reproduces that decoration itself — the
 * predicate below mirrors the Host plugin's, including its exact-name guard.
 */
export interface TaggedModel {
  readonly id: string
  readonly name: string
}

const OFFICIAL_PROVIDERS = new Set(['deepseek-account', 'deepseek-official'])
const TAGGED_MODEL = { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' } as const

export function hasReleaseTag(providerId: string, model: TaggedModel): boolean {
  return (
    OFFICIAL_PROVIDERS.has(providerId) &&
    model.id === TAGGED_MODEL.id &&
    model.name === TAGGED_MODEL.name
  )
}
