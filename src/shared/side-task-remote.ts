import { z } from 'zod'
import { createRemoteInfo } from './remote-info.ts'
import { PACKAGE_NAME } from './identity.ts'

/**
 * Wire contract shared by the two halves.
 *
 * The Host owns the implementation (`ctx.selectQuoteSideTask`); the browser
 * mounts the same descriptor group through `ctx.remote.$mount(...)`. Both
 * schemas are written here so the argument shapes cannot drift apart.
 */
export const SIDE_TASK_SERVICE = 'selectQuoteSideTask'
export const SIDE_TASK_METHOD = `${SIDE_TASK_SERVICE}/create`

const modelShape = () => ({
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional(),
})

const requestSchema = () =>
  z.object({
    prompt: z.string(),
    label: z.string().optional(),
    model: z.object(modelShape()).optional(),
    /** Continue the parent's one side-task child instead of forking a new one. */
    reuse: z.boolean().optional(),
  })

const strictRequestSchema = () =>
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

const resultSchema = () => z.object({ childId: z.string() })

export function createSideTaskRemote() {
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
            {
              name: 'agent',
              wire: 'agentId',
              description: 'owning live agent.',
              source: 'lookup',
              lookup: 'agent',
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
            },
            {
              name: 'request',
              description:
                'initial prompt, display label, optional child model, and whether to reuse the side child.',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: 'dsh-select-quote#SideTaskRequest',
                create: requestSchema,
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
                create: strictRequestSchema,
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
            create: resultSchema,
            description: 'the created child session id.',
            jsonSchema: {
              type: 'object',
              properties: { childId: { type: 'string' } },
              required: ['childId'],
              additionalProperties: false,
            },
          },
          sourceLocation: { file: 'src/side-task-service.ts', line: 1, column: 1 },
        },
      },
    },
    z,
  )
}
