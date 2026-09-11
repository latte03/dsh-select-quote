import type { Context } from '@deepseek-ai/cordis'

/** Minimal faces we need from the client root context. */
export interface SessionsLike {
  scope(id: string): Context | undefined
}

export const runtime: {
  sessions?: SessionsLike
} = {}

/**
 * Bind root services we declared in `inject`. Never touch undeclared
 * properties — Cordis getters throw without inject.
 */
export function bindRuntime(ctx: Context): void {
  runtime.sessions = ctx.sessions
}
