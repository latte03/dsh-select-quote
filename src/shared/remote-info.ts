/**
 * Minimal port of the lazy Remote-descriptor assembly from
 * `@deepseek-ai/dsh-typert-protocol` (MIT, DeepSeek Harness).
 *
 * The shipped protocol package is only reachable from the app bundle, and a
 * profile install cannot resolve it from this package. It is also pure: it
 * turns a descriptor spec into the objects the Gateway mounts, with no
 * transport. Keeping the ~120 lines here removes both the dependency and the
 * chance of importing a second Zod runtime through it.
 */

interface CodecLike {
  mode: string
  typeSymbol: string
  create: () => unknown
  jsonSchema?: unknown
  jsonSchemaError?: string
  decode?: unknown
  encode?: unknown
}

interface ParameterLike {
  name: string
  wire?: string
  description?: string
  source: 'json' | 'lookup'
  lookup?: string
  acceptsUndefined?: boolean
  codec: CodecLike
  strictCodec: CodecLike
}

interface ResultLike {
  mode: string
  typeSymbol: string
  create: () => unknown
  description?: string
  jsonSchema?: unknown
  jsonSchemaError?: string
  decode?: unknown
  encode?: unknown
}

interface DefinitionLike {
  service: string
  description: string
  invocation: { kind: 'direct' }
  scope?: { context: string; wire: string }
  parameters: ParameterLike[]
  result: ResultLike
  sourceLocation?: { file: string; line: number; column: number }
}

/** The slice of the Zod runtime this helper actually calls. */
export interface ZodLike {
  strictObject(shape: Record<string, unknown>): unknown
}

const optional = (parameter: ParameterLike): boolean =>
  parameter.source === 'json' && parameter.acceptsUndefined === true

class NamedInput {
  private schema: unknown

  constructor(
    private readonly parameters: readonly ParameterLike[],
    private readonly strict: boolean,
    private readonly zod: ZodLike,
  ) {}

  private codec(parameter: ParameterLike): CodecLike {
    return this.strict ? parameter.strictCodec : parameter.codec
  }

  create = (): unknown =>
    (this.schema ??= this.zod.strictObject(
      Object.fromEntries(
        this.parameters.map((parameter) => [
          parameter.wire ?? parameter.name,
          this.codec(parameter).create(),
        ]),
      ),
    ))
}

class ResultValue {
  private projection: { value: unknown } | undefined

  constructor(private readonly spec: ResultLike) {}

  get mode(): string {
    return this.spec.mode
  }

  get typeSymbol(): string {
    return this.spec.typeSymbol
  }

  get create(): () => unknown {
    return this.spec.create
  }

  get decode(): unknown {
    return this.spec.decode
  }

  get encode(): unknown {
    return this.spec.encode
  }

  get description(): string | undefined {
    return this.spec.description
  }

  get jsonSchemaError(): string | undefined {
    return this.spec.jsonSchemaError
  }

  get jsonSchema(): unknown {
    this.projection ??= {
      value:
        this.spec.jsonSchema === undefined
          ? undefined
          : { ...(this.spec.jsonSchema as object), description: this.spec.description },
    }
    return this.projection.value
  }
}

export interface RemoteInfo<Descriptor = unknown> {
  readonly package: string
  readonly descriptors: Descriptor[]
  readonly methods: Record<string, unknown>
}

export function createRemoteInfo<Descriptor>(
  spec: { package: string; methods: Record<string, DefinitionLike> },
  zod: ZodLike,
): RemoteInfo<Descriptor> {
  let index: { descriptors: Descriptor[]; methods: Record<string, unknown> } | undefined

  const resolve = () => {
    if (index !== undefined) return index
    const descriptors: Descriptor[] = []
    const methods: Record<string, unknown> = Object.create(null)
    for (const [endpoint, definition] of Object.entries(spec.methods)) {
      const separator = endpoint.indexOf('/')
      const namespace = endpoint.slice(0, separator)
      const method = endpoint.slice(separator + 1)
      const parameters = definition.parameters.map((parameter) => ({
        ...parameter,
        wire: parameter.wire ?? parameter.name,
      }))
      const descriptor = {
        ...definition,
        id: `${spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result:
          definition.result.description === undefined
            ? definition.result
            : new ResultValue(definition.result),
      } as unknown as Descriptor & Record<string, unknown>
      Object.assign(methods, {
        [endpoint]: Object.assign(descriptor, {
          input(options?: { strict?: boolean }) {
            return new NamedInput(parameters, options?.strict === true, zod)
          },
          invoke(remote: Record<string, unknown>, input: Record<string, unknown>) {
            const receiver = Reflect.get(remote, namespace) as Record<string, unknown>
            const fn = Reflect.get(receiver, method) as (...args: unknown[]) => unknown
            return fn.apply(
              receiver,
              parameters.map((parameter) => input[parameter.wire ?? parameter.name]),
            )
          },
        }),
      })
      descriptors.push(descriptor)
    }
    return (index = { descriptors, methods })
  }

  return {
    get package() {
      return spec.package
    },
    get descriptors() {
      return resolve().descriptors
    },
    get methods() {
      return resolve().methods
    },
  }
}
