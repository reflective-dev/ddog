import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../server/app.ts'
import type { MetricsSink } from '../server/metrics.ts'

function fakeSink() {
  return {
    increment: vi.fn(),
    gauge: vi.fn(),
    reportError: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies MetricsSink
}

async function build(sink = fakeSink()) {
  const app = await buildServer({ sink })
  return { app, sink }
}

const post = (app: Awaited<ReturnType<typeof buildServer>>, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/telemetry', payload: payload as object })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BFF /api/telemetry', () => {
  it('accepts a count event and increments the metric', async () => {
    const { app, sink } = await build()
    const response = await post(app, {
      name: 'item.checked',
      kind: 'count',
      value: 1,
      tags: { category: 'Fruit', price: '5' },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({ accepted: true })
    expect(sink.increment).toHaveBeenCalledWith('ddog.item.checked', 1, {
      category: 'Fruit',
      price: '5',
    })
    await app.close()
  })

  it('accepts a gauge event', async () => {
    const { app, sink } = await build()
    await post(app, { name: 'cart.total', kind: 'gauge', value: 17, tags: {} })

    expect(sink.gauge).toHaveBeenCalledWith('ddog.cart.total', 17, {})
    await app.close()
  })

  it('counts an error event and reports the error separately', async () => {
    const { app, sink } = await build()
    await post(app, {
      name: 'cart.limit_exceeded',
      kind: 'error',
      value: 26,
      tags: { limit: '25' },
      error: { name: 'CartLimitExceededError', message: 'over', stack: 'CartLimit...' },
    })

    expect(sink.increment).toHaveBeenCalledWith('ddog.cart.limit_exceeded', 1, { limit: '25' })
    expect(sink.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'CartLimitExceededError', message: 'over' }),
      { limit: '25' },
    )
    await app.close()
  })

  it('reconstructs a real Error with the browser stack for dd-trace', async () => {
    const { app, sink } = await build()
    await post(app, {
      name: 'cart.limit_exceeded',
      kind: 'error',
      value: 26,
      tags: {},
      error: { name: 'CartLimitExceededError', message: 'over', stack: 'at checkItem' },
    })

    const reported = sink.reportError.mock.calls[0]?.[0] as Error
    expect(reported).toBeInstanceOf(Error)
    expect(reported.stack).toBe('at checkItem')
    await app.close()
  })

  it('defaults tags to an empty object when omitted', async () => {
    const { app, sink } = await build()
    const response = await post(app, { name: 'app.started', kind: 'count', value: 1 })

    expect(response.statusCode).toBe(202)
    expect(sink.increment).toHaveBeenCalledWith('ddog.app.started', 1, {})
    await app.close()
  })

  it('rejects a payload with no name', async () => {
    const { app, sink } = await build()
    const response = await post(app, { kind: 'count', value: 1 })

    expect(response.statusCode).toBe(400)
    expect(sink.increment).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an unknown event kind', async () => {
    const { app, sink } = await build()
    const response = await post(app, { name: 'x', kind: 'histogram', value: 1 })

    expect(response.statusCode).toBe(400)
    expect(sink.increment).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects a non-numeric value', async () => {
    const { app } = await build()
    const response = await post(app, { name: 'x', kind: 'count', value: 'lots' })

    expect(response.statusCode).toBe(400)
    await app.close()
  })

  it('rejects a metric name that is not a valid DogStatsD name', async () => {
    const { app } = await build()
    const response = await post(app, { name: 'bad name|with:pipes', kind: 'count', value: 1 })

    expect(response.statusCode).toBe(400)
    await app.close()
  })

  it('returns 500 but does not crash when the sink throws', async () => {
    const sink = fakeSink()
    sink.increment.mockImplementation(() => {
      throw new Error('statsd socket closed')
    })
    const { app } = await build(sink)

    const response = await post(app, { name: 'app.started', kind: 'count', value: 1 })

    expect(response.statusCode).toBe(500)
    await app.close()
  })
})

describe('BFF /api/health', () => {
  it('reports the sink it is using', async () => {
    const { app } = await build()
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
    await app.close()
  })
})
