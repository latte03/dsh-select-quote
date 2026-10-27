import { Service, type Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { SIDE_TASK_SERVICE } from './shared/side-task-remote.ts'
import { isNotResumable, reusableChildId } from './shared/side-task-reuse.ts'

/**
 * Class-prototype key the Typert Gateway reads its Remote method markers from.
 * It is a plain string (not a Symbol), so a third-party package can publish the
 * same marker without importing the protocol package at runtime.
 */
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const REMOTE_METHODS = Object.freeze({
  version: 1,
  methods: Object.freeze([Object.freeze({ method: 'create', invocation: Object.freeze({ kind: 'direct' }) })]),
})

/** Structural slice of `@deepseek-ai/dsh-subagent` this plugin calls. */
interface SubagentService {
  startActivation(spec: {
    provider: string
    label?: string
    /** Reserved identity; requires a local (continuable) backend. */
    childId?: string
    delivery: 'parent' | 'caller'
    request: {
      parent: unknown
      prompt: readonly { type: 'text'; text: string }[]
      /** Per-child route override merged over the parent's current options. */
      agentOptions?: {
        provider: string
        model: string
        reasoningEffort?: string
      }
    }
    signal: AbortSignal
  }): Promise<{ childId: string }>
  /** Browser-equivalent continuation prompt, including cold resume. */
  prompt(
    request: {
      requestId: string
      parentSessionId: string
      childSessionId: string
      mode: 'continuable'
      delivery: 'queue' | 'steer'
      content: readonly { type: 'text'; text: string }[]
    },
    signal: AbortSignal,
  ): Promise<{ messageId: string }>
}

/**
 * Reuse derives the child identity from the parent (`reusableChildId`), so a
 * Host restart or a new browser tab resolves the same child again instead of
 * forking a duplicate.
 */

/** Optional child route chosen in the side-task composer. */
interface SideTaskModel {
  provider: string
  model: string
  reasoningEffort?: string
}

interface LiveAgent {
  readonly id: string
}

/**
 * Host face of the side-task entry point.
 *
 * The browser cannot create a subagent: only the Host half owns
 * `ctx.subagents`, and only a subagent session carries `origin: "subagent"`
 * (which is what keeps it out of the session list). `delivery: "caller"`
 * suppresses the settlement notice the parent would otherwise receive.
 */
export class SelectQuoteSideTask extends Service {
  /** Visible binding the Gateway's source-mode discovery requires. */
  readonly typertRemote: { service: unknown; serviceKey: string; namespace: string }

  constructor(ctx: Context) {
    super(ctx, SIDE_TASK_SERVICE)
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: SIDE_TASK_SERVICE,
      namespace: SIDE_TASK_SERVICE,
    })
  }

  async create(
    agent: LiveAgent,
    request: { prompt: string; label?: string; model?: SideTaskModel; reuse?: boolean },
  ): Promise<{ childId: string }> {
    const prompt = request.prompt.trim()
    if (!prompt) throw new Error('side task prompt must not be empty')
    const subagents = (this.ctx as unknown as { subagents?: SubagentService }).subagents
    if (subagents === undefined) throw new Error('the subagent service is unavailable')
    const agentOptions =
      request.model === undefined
        ? undefined
        : {
            provider: request.model.provider,
            model: request.model.model,
            ...(request.model.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: request.model.reasoningEffort }),
          }
    const childId = request.reuse === true ? reusableChildId(agent.id) : undefined
    if (childId !== undefined) {
      try {
        await subagents.prompt(
          {
            requestId: randomUUID(),
            parentSessionId: agent.id,
            childSessionId: childId,
            mode: 'continuable',
            delivery: 'queue',
            content: [{ type: 'text', text: prompt }],
          },
          new AbortController().signal,
        )
        return { childId }
      } catch (error) {
        // The deterministic child does not exist yet (first question in this
        // mode, or its session was deleted): create it below under the same id.
        // Every other refusal is real — running/capacity/authorization — and
        // must surface instead of silently forking a parallel child.
        if (!isNotResumable(error)) throw error
      }
    }
    const receipt = await subagents.startActivation({
      provider: 'fork',
      ...(request.label === undefined ? {} : { label: request.label }),
      ...(childId === undefined ? {} : { childId }),
      delivery: 'caller',
      request: {
        parent: agent,
        prompt: [{ type: 'text', text: prompt }],
        ...(agentOptions === undefined ? {} : { agentOptions }),
      },
      signal: new AbortController().signal,
    })
    return { childId: receipt.childId }
  }
}

// Attach after the class declaration: the Gateway reads markers off the live
// instance's prototype, and the key is the protocol package's public string.
Object.defineProperty(SelectQuoteSideTask.prototype, REMOTE_METHOD_DESCRIPTOR, {
  configurable: true,
  value: REMOTE_METHODS,
})
