/**
 * In-memory store of finished translations.
 *
 * Reopening the same passage or flipping back to a language already seen is
 * common, and each miss costs a billed model call. Keys carry everything that
 * changes the output — text, target, route, prompt and session — so a config
 * change can never serve stale text. Nothing is persisted: a reload starts
 * clean, and the selected conversation text never touches disk.
 */

import type { TranslateLanguage } from './translate.ts'

/** Enough for a reading session without letting the map grow unbounded. */
export const TRANSLATE_CACHE_LIMIT = 20

export interface TranslateCacheKey {
  readonly text: string
  readonly target: TranslateLanguage
  /** Empty follows the conversation's route; part of the key either way. */
  readonly provider: string
  readonly model: string
  /** Fully resolved system prompt, after `{target}` substitution. */
  readonly prompt: string
  readonly sessionId: string
}

const entries = new Map<string, string>()

function cacheId(key: TranslateCacheKey): string {
  return JSON.stringify([
    key.sessionId,
    key.provider,
    key.model,
    key.target,
    key.prompt,
    key.text,
  ])
}

export function readTranslation(key: TranslateCacheKey): string | undefined {
  const id = cacheId(key)
  const hit = entries.get(id)
  if (hit === undefined) return undefined
  // Recency is insertion order; touch by re-inserting at the end.
  entries.delete(id)
  entries.set(id, hit)
  return hit
}

export function writeTranslation(key: TranslateCacheKey, text: string): void {
  if (text.trim().length === 0) return
  const id = cacheId(key)
  entries.delete(id)
  entries.set(id, text)
  while (entries.size > TRANSLATE_CACHE_LIMIT) {
    const oldest = entries.keys().next()
    if (oldest.done) break
    entries.delete(oldest.value)
  }
}

/** Test hook: the runtime cache lives for the page, not for one component. */
export function clearTranslationCache(): void {
  entries.clear()
}
