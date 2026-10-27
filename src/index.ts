import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SelectQuoteSideTask } from './side-task-service.ts'
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
  shortcut: Volatile<boolean>
  sideTaskMode: Volatile<'separate' | 'reuse'>
}

export const Config = z.object({
  triggerMode: z.union(['auto', 'contextmenu', 'both']).default('auto').volatile(),
  shortcut: z.boolean().default(false).volatile(),
  sideTaskMode: z.union(['separate', 'reuse']).default('separate').volatile(),
})

export const name = PACKAGE_NAME

export function apply(ctx: Context, _config: Config): void {
  // Optional: the side-task entry point only exists where the subagent
  // service does. Waiting on it at the top level would turn a shell without
  // subagents into an activation failure instead of a missing button.
  ctx.inject(['subagents'], (scope) => {
    new SelectQuoteSideTask(scope)
  })
}
