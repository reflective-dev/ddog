import Fastify, { type FastifyInstance } from 'fastify'
import type { MetricsSink, Tags } from './metrics.ts'

/** Mirrors the browser's METRIC_PREFIX so both sides land in one namespace. */
const METRIC_PREFIX = 'ddog'

/** DogStatsD metric names: dots, letters, digits, underscores and dashes only. */
const METRIC_NAME = /^[a-zA-Z][a-zA-Z0-9_.-]*$/

const KINDS = ['count', 'gauge', 'error'] as const
type Kind = (typeof KINDS)[number]

interface SerializedError {
  name: string
  message: string
  stack: string
}

interface TelemetryPayload {
  name: string
  kind: Kind
  value: number
  tags: Tags
  error?: SerializedError
}

class ValidationError extends Error {}

function parsePayload(body: unknown): TelemetryPayload {
  if (typeof body !== 'object' || body === null) throw new ValidationError('body must be an object')
  const raw = body as Record<string, unknown>

  if (typeof raw.name !== 'string' || !METRIC_NAME.test(raw.name)) {
    throw new ValidationError('name must be a valid metric name')
  }
  if (typeof raw.kind !== 'string' || !(KINDS as readonly string[]).includes(raw.kind)) {
    throw new ValidationError(`kind must be one of ${KINDS.join(', ')}`)
  }
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) {
    throw new ValidationError('value must be a finite number')
  }

  const tags: Tags = {}
  if (raw.tags !== undefined) {
    if (typeof raw.tags !== 'object' || raw.tags === null) {
      throw new ValidationError('tags must be an object')
    }
    for (const [key, value] of Object.entries(raw.tags)) tags[key] = String(value)
  }

  const payload: TelemetryPayload = { name: raw.name, kind: raw.kind as Kind, value: raw.value, tags }

  const error = raw.error as Record<string, unknown> | undefined
  if (error && typeof error === 'object') {
    payload.error = {
      name: String(error.name ?? 'Error'),
      message: String(error.message ?? ''),
      stack: String(error.stack ?? ''),
    }
  }

  return payload
}

/** Rebuilds a real Error so dd-trace records the browser's stack, not the server's. */
function reviveError({ name, message, stack }: SerializedError): Error {
  const error = new Error(message)
  error.name = name
  if (stack) error.stack = stack
  return error
}

export interface BuildServerOptions {
  sink: MetricsSink
  logger?: boolean
}

export async function buildServer({ sink, logger = false }: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger })

  app.get('/api/health', async () => ({ status: 'ok' }))

  app.post('/api/telemetry', async (request, reply) => {
    let event: TelemetryPayload
    try {
      event = parsePayload(request.body)
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message })
    }

    const metric = `${METRIC_PREFIX}.${event.name}`

    try {
      if (event.kind === 'gauge') {
        sink.gauge(metric, event.value, event.tags)
      } else {
        // Errors are counted like any other event; the stack goes to the tracer.
        sink.increment(metric, 1, event.tags)
      }

      if (event.kind === 'error' && event.error) {
        sink.reportError(reviveError(event.error), event.tags)
      }
    } catch (error) {
      request.log.error({ err: error }, 'failed to forward telemetry')
      return reply.code(500).send({ error: 'failed to forward telemetry' })
    }

    return reply.code(202).send({ accepted: true })
  })

  app.addHook('onClose', async () => {
    await sink.close()
  })

  return app
}
