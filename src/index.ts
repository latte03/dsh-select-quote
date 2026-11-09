import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SelectQuoteSideTask } from './side-task-service.ts'
import { SelectQuoteTranslate } from './translate-service.ts'
import { PACKAGE_NAME } from './shared/identity.ts'

/**
 * Node half of dsh-select-quote. The product surface is the browser client
 * module (`./client`); this entry keeps the package mounted in the Loader so
 * Host can discover `dsh.client`, and carries the config schema the settings
 * page edits.
 *
 * Every field is volatile: only volatile fields are mirrored into the settings
 * schema and applied live. The browser half never receives this object — it
 * reads the same values through `ctx.configForms` (see `client/config.ts`).
 */
export interface Config {
  triggerMode: Volatile<'auto' | 'contextmenu' | 'both'>
  toolbarPlacement: Volatile<'above' | 'below'>
  /** Our actions ride inside the Host's selection surface (see `client/config.ts`). */
  mergeHostSurface: Volatile<boolean>
  shortcut: Volatile<boolean>
  showCopy: Volatile<boolean>
  showTranslate: Volatile<boolean>
  showAskInSide: Volatile<boolean>
  showAnnotate: Volatile<boolean>
  sideTaskMode: Volatile<'separate' | 'reuse'>
  translateTarget: Volatile<'auto' | 'zh' | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt'>
  translateHideSameLanguage: Volatile<boolean>
  translateProvider: Volatile<string>
  translateModel: Volatile<string>
  translatePrompt: Volatile<string>
}

export const Config = z.object({
  triggerMode: z.union(['auto', 'contextmenu', 'both']).default('auto').volatile(),
  toolbarPlacement: z.union(['above', 'below']).default('below').volatile(),
  // The merged surface takes over the Host's `quote` cell, so its own quote
  // button becomes ours to render; off keeps the Host pill exactly as shipped.
  mergeHostSurface: z.boolean().default(false).volatile(),
  shortcut: z.boolean().default(false).volatile(),
  showCopy: z.boolean().default(true).volatile(),
  showTranslate: z.boolean().default(true).volatile(),
  showAskInSide: z.boolean().default(true).volatile(),
  showAnnotate: z.boolean().default(true).volatile(),
  sideTaskMode: z.union(['separate', 'reuse']).default('separate').volatile(),
  translateTarget: z
    .union(['auto', 'zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
    .default('auto')
    .volatile(),
  translateHideSameLanguage: z.boolean().default(false).volatile(),
  translateProvider: z.string().default('').volatile(),
  translateModel: z.string().default('').volatile(),
  translatePrompt: z.string().default('').volatile(),
})

export const name = PACKAGE_NAME

export function apply(ctx: Context, _config: Config): void {
  // Optional: the side-task entry point only exists where the subagent
  // service does. Waiting on it at the top level would turn a shell without
  // subagents into an activation failure instead of a missing button.
  ctx.inject(['subagents'], (scope) => {
    new SelectQuoteSideTask(scope)
  })
  // Translation calls the provider directly; no subagent, no conversation
  // context. A shell without `llm` simply never publishes the button's bridge.
  ctx.inject(['llm'], (scope) => {
    new SelectQuoteTranslate(scope)
  })
}
