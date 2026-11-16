/**
 * Resource address and tab identity for a side-question fork.
 *
 * The address is the right sidebar's public currency; keeping it in one module
 * stops the producer (the send flow) and the consumer (the tab/resource owner)
 * from drifting apart.
 */

const HOST = 'select-quote-side'

export const SIDE_FORK_PROTOCOL = HOST
export const SIDE_FORK_KIND = HOST
export const SIDE_FORK_TAB_ID = 'dsh-select-quote-side-chat'
export const SIDE_FORK_SLOT = 'dsh-select-quote.side.chat'

export function sideForkAddress(sessionId: string): string {
  return `dsh-resource://${HOST}/session/${encodeURIComponent(sessionId)}`
}

export function parseSideForkAddress(address: string): string | undefined {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  if (url.protocol !== 'dsh-resource:' || url.hostname !== HOST) return undefined
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 2 || parts[0] !== 'session') return undefined
  try {
    return decodeURIComponent(parts[1] as string)
  } catch {
    return undefined
  }
}
