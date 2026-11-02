import { Service, type Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import {
  TRANSLATE_SERVICE,
  type TranslateStreamEvent,
} from './shared/plugin-remote.ts'

/**
 * Host face of the translation entry point.
 *
 * The browser owns the popover, language choice, and the prompt (built-in or
 * the user's custom text). This service only resolves the route, calls the
 * provider once, and streams the text back. No subagent and no session
 * context: the model receives exactly the system prompt plus the selected
 * passage.
 *
 * Thinking is requested off. A route that cannot disable it keeps its own
 * default; the stream then announces `thinking` so the popover can show a
 * reasoning loader instead of a frozen spinner.
 */

const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const REMOTE_METHODS = Object.freeze({
  version: 1,
  methods: Object.freeze([
    Object.freeze({
      method: 'translate',
      mode: 'stream',
      invocation: Object.freeze({ kind: 'direct' }),
    }),
  ]),
})

/** Generous enough for a reasoning model to answer one bounded passage. */
const TIMEOUT_MS = 90_000
const MAX_TEXT_CHARS = 8000
const MAX_PROMPT_CHARS = 8000
const LANGUAGES = new Set(['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])

interface LlmChunk {
  readonly type: string
  readonly text?: string
  /** Full final block; some adapters deliver only this, never deltas. */
  readonly block?: { readonly type?: string; readonly text?: string }
  readonly reason?: {
    readonly kind?: string
    readonly failure?: { readonly code?: string; readonly message?: string }
  }
}

interface PreparedCall {
  readonly config: Record<string, unknown>
  stream(options: Record<string, unknown>): AsyncIterable<LlmChunk>
}

interface LlmService {
  prepareCall(
    config: { provider: string; model: string; reasoningEffort?: string },
    signal: AbortSignal,
  ): Promise<PreparedCall>
}

interface AgentOptions {
  readonly provider?: string
  readonly model?: string
}

interface LiveAgent {
  readonly id: string
  readonly options?: AgentOptions
}

interface DefaultModel {
  currentSelection(): AgentOptions
}

interface Logger {
  info(format: unknown, ...args: unknown[]): void
  warn(format: unknown, ...args: unknown[]): void
  debug(format: unknown, ...args: unknown[]): void
}

/** Structural view of the services this class touches. */
interface HostServices {
  readonly llm?: LlmService
  readonly logger?: Logger | ((name?: string) => Logger)
  get(name: string): unknown
}

export interface TranslateRequest {
  readonly text: string
  readonly target: string
  readonly prompt: string
  readonly provider?: string
  readonly model?: string
}

export class SelectQuoteTranslate extends Service {
  /** Visible binding the Gateway's source-mode discovery requires. */
  readonly typertRemote: { service: unknown; serviceKey: string; namespace: string }

  constructor(ctx: Context) {
    super(ctx, TRANSLATE_SERVICE)
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: TRANSLATE_SERVICE,
      namespace: TRANSLATE_SERVICE,
    })
  }

  async *translate(
    agent: LiveAgent,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<TranslateStreamEvent> {
    const services = this.ctx as unknown as HostServices
    const log = loggerOf(services.logger)
    const meta = {
      target: request.target,
      chars: request.text.length,
      provider: request.provider,
      model: request.model,
    }

    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = (): void => {
      controller.abort(signal?.reason)
    }
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('translation timed out'))
    }, TIMEOUT_MS)
    if (signal?.aborted) abortFromCaller()
    else signal?.addEventListener('abort', abortFromCaller, { once: true })

    try {
      if (request.text.trim().length === 0) throw new Error('nothing to translate')
      if (request.text.length > MAX_TEXT_CHARS) {
        throw new Error('the selection is too long to translate')
      }
      if (request.prompt.trim().length === 0) throw new Error('the translation prompt is empty')
      if (request.prompt.length > MAX_PROMPT_CHARS) {
        throw new Error('the translation prompt is too long')
      }
      if (!LANGUAGES.has(request.target)) throw new Error('unsupported translation target')

      const llm = services.llm
      if (llm === undefined) throw new Error('the model service is unavailable')
      const route = resolveRoute(agent, request, services)
      if (route === undefined) throw new Error('no translation model is available')
      meta.provider = route.provider
      meta.model = route.model
      controller.signal.throwIfAborted()

      // No maxTokens override: provider defaults stay within each model's own
      // output ceiling, and a fixed guess would be rejected by smaller models.
      const call = await prepareCall(llm, route, controller.signal, log)
      controller.signal.throwIfAborted()

      // `off` means the provider accepted disabled thinking. An explicit other
      // effort means reasoning stays on; an absent effort keeps the provider
      // default, and the first reasoning delta decides instead of guessing.
      const effort = call.config.reasoningEffort
      let thinking = typeof effort === 'string' && effort !== 'off'
      if (thinking) {
        log?.debug(
          'dsh-select-quote: translation keeps reasoning on for %s/%s',
          route.provider,
          route.model,
        )
      }
      yield { type: 'thinking', active: thinking }

      const messages = [
        {
          id: randomUUID(),
          role: 'user',
          content: [{ type: 'text', text: request.text }],
          source: { kind: 'dsh-select-quote' },
        },
      ]
      const options = {
        ...call.config,
        messages,
        system: request.prompt,
        sessionId: agent.id,
        purpose: 'select-quote-translate',
        signal: controller.signal,
      }

      let accumulated = ''
      let reasoning = ''
      let failure: LlmChunk['reason']
      for await (const chunk of call.stream(options)) {
        controller.signal.throwIfAborted()
        if (chunk.type === 'reasoning-delta') {
          const delta = chunk.text ?? ''
          if (delta.length === 0) continue
          if (!thinking) {
            thinking = true
            yield { type: 'thinking', active: true }
          }
          reasoning += delta
          yield { type: 'reasoning', text: reasoning }
        } else if (chunk.type === 'block-end' && chunk.block?.type === 'reasoning') {
          // Adapters that do not stream reasoning still report the finished block.
          const full = chunk.block.text ?? ''
          if (full.length === 0 || reasoning.length > 0) continue
          if (!thinking) {
            thinking = true
            yield { type: 'thinking', active: true }
          }
          reasoning = full
          yield { type: 'reasoning', text: reasoning }
        } else if (chunk.type === 'text-delta') {
          const delta = chunk.text ?? ''
          if (delta.length === 0) continue
          if (thinking) {
            thinking = false
            yield { type: 'thinking', active: false }
          }
          accumulated += delta
          yield { type: 'text', text: accumulated }
        } else if (chunk.type === 'block-end' && chunk.block?.type === 'text') {
          // Some adapters skip deltas and only report the finished block.
          const full = chunk.block.text ?? ''
          if (full.length === 0 || accumulated.length > 0) continue
          if (thinking) {
            thinking = false
            yield { type: 'thinking', active: false }
          }
          accumulated = full
          yield { type: 'text', text: accumulated }
        } else if (chunk.type === 'finish') {
          failure = chunk.reason
        }
      }
      controller.signal.throwIfAborted()
      if (failure?.kind === 'error' || failure?.kind === 'aborted') {
        const code = failure.failure?.code
        const message = failure.failure?.message
        throw new Error(
          code === undefined
            ? message === undefined
              ? 'translation failed'
              : trimMessage(message)
            : `${code}: ${trimMessage(message ?? 'translation failed')}`,
        )
      }
      const translated = accumulated.trim()
      if (translated.length === 0) {
        throw new Error(
          failure?.kind === 'max-tokens'
            ? 'the model ran out of output tokens before returning a translation'
            : 'the model returned no translation',
        )
      }
      if (failure?.kind === 'max-tokens') {
        log?.warn(
          'dsh-select-quote: translation truncated at the output limit for %s/%s',
          route.provider,
          route.model,
        )
      } else if (
        failure?.kind !== undefined &&
        failure.kind !== 'stop'
      ) {
        log?.warn(
          'dsh-select-quote: translation finished with %s for %s/%s',
          failure.kind,
          route.provider,
          route.model,
        )
      }
      yield { type: 'done', text: translated }
    } catch (error) {
      if (timedOut) {
        const timeout = new Error('translation timed out')
        logFailure(log, meta, timeout, routeOf(meta))
        throw timeout
      }
      if (signal?.aborted) {
        log?.debug('dsh-select-quote: translation cancelled by the client')
        throw error
      }
      logFailure(log, meta, error, routeOf(meta))
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

/** Prefer disabled thinking; fall back to the provider default when rejected. */
async function prepareCall(
  llm: LlmService,
  route: { provider: string; model: string },
  signal: AbortSignal,
  log: Logger | undefined,
): Promise<PreparedCall> {
  try {
    return await llm.prepareCall(
      { provider: route.provider, model: route.model, reasoningEffort: 'off' },
      signal,
    )
  } catch (error) {
    signal.throwIfAborted()
    log?.debug(
      'dsh-select-quote: thinking cannot be disabled for %s/%s (%s); using the model default',
      route.provider,
      route.model,
      describe(error),
    )
    return llm.prepareCall(route, signal)
  }
}

/** Explicit config route wins; otherwise follow the conversation's own model. */
function resolveRoute(
  agent: LiveAgent,
  request: TranslateRequest,
  services: HostServices,
): { provider: string; model: string } | undefined {
  if (request.provider !== undefined && request.model !== undefined) {
    return { provider: request.provider, model: request.model }
  }
  const live = agent.options
  if (live?.provider !== undefined && live.model !== undefined) {
    return { provider: live.provider, model: live.model }
  }
  const fallback = services.get('agentDefaultModel') as DefaultModel | undefined
  const current = fallback?.currentSelection()
  if (current?.provider !== undefined && current.model !== undefined) {
    return { provider: current.provider, model: current.model }
  }
  return undefined
}

/** Resolve the callable logger facade (`ctx.logger` is callable in Cordis). */
function loggerOf(source: HostServices['logger']): Logger | undefined {
  if (typeof source === 'function') {
    try {
      return source('dsh-select-quote')
    } catch {
      return undefined
    }
  }
  return source
}

function routeOf(meta: { provider?: string; model?: string }): string {
  return `${meta.provider ?? '?'}/${meta.model ?? '?'}`
}

function logFailure(
  log: Logger | undefined,
  meta: { target: string; chars: number; provider?: string; model?: string },
  error: unknown,
  route: string,
): void {
  log?.warn(
    'dsh-select-quote: translation failed %o',
    {
      target: meta.target,
      chars: meta.chars,
      route,
      error: describe(error),
    },
  )
}

function trimMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim()
  return oneLine.length > 240 ? `${oneLine.slice(0, 239)}…` : oneLine
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code
    return typeof code === 'string' ? `${code}: ${error.message}` : error.message
  }
  return String(error)
}

// Attach after the class declaration: the Gateway reads markers off the live
// instance's prototype, and the key is the protocol package's public string.
Object.defineProperty(SelectQuoteTranslate.prototype, REMOTE_METHOD_DESCRIPTOR, {
  configurable: true,
  value: REMOTE_METHODS,
})
