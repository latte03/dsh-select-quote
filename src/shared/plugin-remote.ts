import { z } from 'zod'
import { createRemoteInfo } from './remote-info.ts'
import { PACKAGE_NAME } from './identity.ts'

/**
 * Wire contract shared by the two halves.
 *
 * The Host owns the implementation (`ctx.selectQuoteTranslate`); the browser
 * mounts the same descriptor group through `ctx.remote.$mount(...)`. The
 * request schema is written here so the two sides cannot drift apart.
 */
export const TRANSLATE_SERVICE = 'selectQuoteTranslate'
export const TRANSLATE_METHOD = `${TRANSLATE_SERVICE}/translate`

/** Host-side deletion of archived, unkept side-fork logs. */
export const SIDE_FORK_RETENTION_SERVICE = 'selectQuoteSideForkRetention'
export const SIDE_FORK_RETENTION_METHOD = `${SIDE_FORK_RETENTION_SERVICE}/prune`

export interface SideForkPruneRequest {
  /** Client-selected candidates; the Host validates every one again. */
  readonly sessionIds: readonly string[]
  /** Delete a fork whose log was last written at or before this time. */
  readonly cutoffMs: number
}

export type SideForkPruneSkipReason =
  | 'invalid-id'
  | 'not-archived'
  | 'live'
  | 'missing'
  | 'not-fork'
  | 'no-path'
  | 'unsafe-path'
  | 'recent'
  | 'io-error'

export interface SideForkPruneResult {
  readonly deleted: readonly string[]
  readonly skipped: readonly {
    readonly id: string
    readonly reason: SideForkPruneSkipReason
  }[]
}

/**
 * One frame of the translation stream. `text` is always the whole translation
 * so far, so a dropped or reordered frame cannot corrupt the painted result.
 */
export type TranslateStreamEvent =
  | { readonly type: 'thinking'; readonly active: boolean }
  | { readonly type: 'reasoning'; readonly text: string }
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'done'; readonly text: string }

const translateRouteShape = () => ({
  provider: z.string().optional(),
  model: z.string().optional(),
})

const translateRequestSchema = () =>
  z.object({
    text: z.string(),
    target: z.string(),
    /** Resolved instructions: built-in or the user's custom prompt. */
    prompt: z.string(),
    ...translateRouteShape(),
  })

const strictTranslateRequestSchema = () =>
  z.strictObject({
    text: z.string(),
    target: z.string(),
    prompt: z.string(),
    ...translateRouteShape(),
  })

const translateJsonSchema = (additionalProperties: boolean) => ({
  type: 'object',
  properties: {
    text: { type: 'string' },
    target: { type: 'string' },
    prompt: { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string' },
  },
  required: ['text', 'target', 'prompt'],
  additionalProperties,
})

const pruneRequestShape = () => ({
  sessionIds: z.array(z.string()).max(512),
  cutoffMs: z.number(),
})

const pruneRequestSchema = () => z.object(pruneRequestShape())
const strictPruneRequestSchema = () => z.strictObject(pruneRequestShape())

const pruneJsonSchema = (additionalProperties: boolean) => ({
  type: 'object',
  properties: {
    sessionIds: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 512,
    },
    cutoffMs: { type: 'number' },
  },
  required: ['sessionIds', 'cutoffMs'],
  additionalProperties,
})

const pruneResultSchema = () =>
  z.object({
    deleted: z.array(z.string()),
    skipped: z.array(
      z.object({
        id: z.string(),
        reason: z.string(),
      }),
    ),
  })

const pruneResultJsonSchema = {
  type: 'object',
  properties: {
    deleted: { type: 'array', items: { type: 'string' } },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['deleted', 'skipped'],
  additionalProperties: false,
} as const

/** The owning live agent, resolved by the Gateway from the session id. */
const agentParameter = () => ({
  name: 'agent',
  wire: 'agentId',
  description: 'owning live agent.',
  source: 'lookup' as const,
  lookup: 'agent' as const,
  codec: {
    mode: 'strict',
    typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    create: () => z.string(),
    jsonSchema: { type: 'string' },
  },
  strictCodec: {
    mode: 'strict',
    typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    create: () => z.string(),
    jsonSchema: { type: 'string' },
  },
})

export function createPluginRemote() {
  return createRemoteInfo(
    {
      package: PACKAGE_NAME,
      methods: {
        [TRANSLATE_METHOD]: {
          service: TRANSLATE_SERVICE,
          description: 'Stream one translation of a selected passage with a direct model call.',
          invocation: { kind: 'direct' },
          /** Live stream: thinking state, growing text snapshots, then the final text. */
          mode: 'stream',
          cancellation: { parameter: 'signal' },
          scope: { context: 'agent', wire: 'agentId' },
          parameters: [
            agentParameter(),
            {
              name: 'request',
              description:
                'selected text, target language, resolved instructions, and optional model route.',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#TranslateRequest',
                create: translateRequestSchema,
                jsonSchema: translateJsonSchema(true),
              },
              strictCodec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#TranslateRequest',
                create: strictTranslateRequestSchema,
                jsonSchema: translateJsonSchema(false),
              },
            },
          ],
          result: {
            mode: 'strict',
            typeSymbol: 'dsh-select-quote#TranslateStreamEvent',
            create: () =>
              z.object({
                type: z.string(),
                text: z.string().optional(),
                active: z.boolean().optional(),
              }),
            description: 'streamed translation events.',
            jsonSchema: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                text: { type: 'string' },
                active: { type: 'boolean' },
              },
              required: ['type'],
              additionalProperties: false,
            },
          },
        },
        [SIDE_FORK_RETENTION_METHOD]: {
          service: SIDE_FORK_RETENTION_SERVICE,
          description:
            'Delete archived, unkept side-question fork logs that are older than the cutoff.',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'request',
              description:
                'candidate session ids from this client and the last-write cutoff in epoch milliseconds.',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#SideForkPruneRequest',
                create: pruneRequestSchema,
                jsonSchema: pruneJsonSchema(true),
              },
              strictCodec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#SideForkPruneRequest',
                create: strictPruneRequestSchema,
                jsonSchema: pruneJsonSchema(false),
              },
            },
          ],
          result: {
            mode: 'strict',
            typeSymbol: 'dsh-select-quote#SideForkPruneResult',
            create: pruneResultSchema,
            description: 'deleted session ids and per-id skip reasons.',
            jsonSchema: pruneResultJsonSchema,
          },
        },
      },
    },
    z,
  )
}
