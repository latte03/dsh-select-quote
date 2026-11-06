import { z } from 'zod'
import { createRemoteInfo } from './remote-info.ts'
import { PACKAGE_NAME } from './identity.ts'

/**
 * Wire contract shared by the two halves.
 *
 * The Host owns the implementations (`ctx.selectQuoteSideTask`,
 * `ctx.selectQuoteTranslate`); the browser mounts the same descriptor group
 * through `ctx.remote.$mount(...)`. Both schemas are written here so the
 * argument shapes cannot drift apart.
 */
export const SIDE_TASK_SERVICE = 'selectQuoteSideTask'
export const SIDE_TASK_METHOD = `${SIDE_TASK_SERVICE}/create`
export const TRANSLATE_SERVICE = 'selectQuoteTranslate'
export const TRANSLATE_METHOD = `${TRANSLATE_SERVICE}/translate`

/**
 * One frame of the translation stream. `text` is always the whole translation
 * so far, so a dropped or reordered frame cannot corrupt the painted result.
 */
export type TranslateStreamEvent =
  | { readonly type: 'thinking'; readonly active: boolean }
  | { readonly type: 'reasoning'; readonly text: string }
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'done'; readonly text: string }

const modelShape = () => ({
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional(),
})

const sideRequestSchema = () =>
  z.object({
    prompt: z.string(),
    label: z.string().optional(),
    model: z.object(modelShape()).optional(),
    /** Continue the parent's one side-task child instead of forking a new one. */
    reuse: z.boolean().optional(),
  })

const strictSideRequestSchema = () =>
  z.strictObject({
    prompt: z.string(),
    label: z.string().optional(),
    model: z.strictObject(modelShape()).optional(),
    reuse: z.boolean().optional(),
  })

const modelJsonSchema = (additionalProperties: boolean) => ({
  type: 'object',
  properties: {
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoningEffort: { type: 'string' },
  },
  required: ['provider', 'model'],
  additionalProperties,
})

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
        [SIDE_TASK_METHOD]: {
          service: SIDE_TASK_SERVICE,
          description: 'Start a fork-backed side task for one live agent.',
          invocation: { kind: 'direct' },
          scope: { context: 'agent', wire: 'agentId' },
          parameters: [
            agentParameter(),
            {
              name: 'request',
              description:
                'initial prompt, display label, optional child model, and whether to reuse the side child.',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#SideTaskRequest',
                create: sideRequestSchema,
                jsonSchema: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string' },
                    label: { type: 'string' },
                    model: modelJsonSchema(true),
                    reuse: { type: 'boolean' },
                  },
                  required: ['prompt'],
                  additionalProperties: true,
                },
              },
              strictCodec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#SideTaskRequest',
                create: strictSideRequestSchema,
                jsonSchema: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string' },
                    label: { type: 'string' },
                    model: modelJsonSchema(false),
                    reuse: { type: 'boolean' },
                  },
                  required: ['prompt'],
                  additionalProperties: false,
                },
              },
            },
          ],
          result: {
            mode: 'strict',
            typeSymbol: 'dsh-select-quote#SideTaskCreateResult',
            create: () => z.object({ childId: z.string() }),
            description: 'the created child session id.',
            jsonSchema: {
              type: 'object',
              properties: { childId: { type: 'string' } },
              required: ['childId'],
              additionalProperties: false,
            },
          },
        },
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
      },
    },
    z,
  )
}
