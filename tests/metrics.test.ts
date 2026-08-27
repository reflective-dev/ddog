import { describe, expect, it, vi } from 'vitest'
import { StatsdSink, formatTags } from '../server/metrics.ts'

function fakeStatsd() {
  return {
    increment: vi.fn(),
    gauge: vi.fn(),
    close: vi.fn((cb: (error?: Error) => void) => cb()),
  }
}

describe('formatTags', () => {
  it('turns a tag record into hot-shots array form', () => {
    expect(formatTags({ category: 'Fruit', price: '5' })).toEqual(['category:Fruit', 'price:5'])
  })

  it('returns an empty array for no tags', () => {
    expect(formatTags({})).toEqual([])
  })

  it('sanitizes characters DogStatsD reserves, matching the browser transport', () => {
    // "Ice Cream" must not reach the agent with a raw space in it.
    expect(formatTags({ to: 'Ice Cream' })).toEqual(['to:Ice_Cream'])
    expect(formatTags({ a: 'x,y', b: 'p|q', c: 'k:v' })).toEqual(['a:x_y', 'b:p_q', 'c:k_v'])
  })
})

describe('StatsdSink', () => {
  it('increments through the underlying client', () => {
    const client = fakeStatsd()
    new StatsdSink(client).increment('ddog.app.started', 1, { category: 'Fruit' })

    expect(client.increment).toHaveBeenCalledWith('ddog.app.started', 1, ['category:Fruit'])
  })

  it('gauges through the underlying client', () => {
    const client = fakeStatsd()
    new StatsdSink(client).gauge('ddog.cart.total', 17, {})

    expect(client.gauge).toHaveBeenCalledWith('ddog.cart.total', 17, [])
  })

  it('reports errors to the tracer when one is provided', () => {
    const client = fakeStatsd()
    const span = { setTag: vi.fn() }
    const tracer = { scope: () => ({ active: () => span }) }
    const error = new Error('boom')

    new StatsdSink(client, tracer).reportError(error, { limit: '25' })

    expect(span.setTag).toHaveBeenCalledWith('error', error)
    expect(span.setTag).toHaveBeenCalledWith('limit', '25')
  })

  it('still counts the error metric when no span is active', () => {
    const client = fakeStatsd()
    const tracer = { scope: () => ({ active: () => null }) }

    expect(() =>
      new StatsdSink(client, tracer).reportError(new Error('boom'), {}),
    ).not.toThrow()
    expect(client.increment).toHaveBeenCalledWith('ddog.errors', 1, ['error_type:Error'])
  })

  it('works with no tracer at all', () => {
    const client = fakeStatsd()
    expect(() => new StatsdSink(client).reportError(new Error('boom'), {})).not.toThrow()
  })

  it('closes the underlying client', async () => {
    const client = fakeStatsd()
    await new StatsdSink(client).close()
    expect(client.close).toHaveBeenCalledOnce()
  })
})
