import type { Context } from '@deepseek-ai/cordis'

/**
 * Node half of dsh-select-quote. The product surface is the browser client
 * module (`./client`); this entry only keeps the package mounted in the
 * Loader so Host can discover `dsh.client` and serve the bundle.
 */
export const name = 'dsh-select-quote'

export function apply(_ctx: Context): void {
  console.log('[dsh-select-quote] plugin loaded (client UI via conversation.input.overlay)')
}
