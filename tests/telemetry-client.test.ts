import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTelemetry } from '../src/telemetry/client.ts'
import { MockTransport } from '../src/telemetry/transports/mock.ts'
import { appStarted, tabChanged } from '../src/telemetry/events.ts'
import { CartLimitExceededError } from '../src/domain/cart.ts'
import { cartLimitExceeded } from '../src/telemetry/events.ts'

describe('telemetry client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in the mode it is given', () => {
    const telemetry = createTelemetry({ mode: 'off' })
    expect(telemetry.mode).toBe('off')
  })

  it('sends nothing at all in off mode', () => {
    const mock = new MockTransport()
    const telemetry = createTelemetry({ mode: 'off', transports: { mock } })

    telemetry.send(appStarted())
    telemetry.send(tabChanged('Fruit', 'Veggies'))

    expect(mock.events).toHaveLength(0)
  })

  it('captures events locally in mock mode', () => {
    const mock = new MockTransport()
    const telemetry = createTelemetry({ mode: 'mock', transports: { mock } })

    telemetry.send(appStarted())

    expect(mock.events).toHaveLength(1)
    expect(mock.events[0]).toMatchObject({ name: 'app.started' })
  })

  it('routes to the agent transport in agent mode', () => {
    const mock = new MockTransport()
    const agent = new MockTransport()
    const telemetry = createTelemetry({ mode: 'agent', transports: { mock, agent } })

    telemetry.send(appStarted())

    expect(agent.events).toHaveLength(1)
    expect(mock.events).toHaveLength(0)
  })

  it('switches modes at runtime and routes subsequent events to the new transport', () => {
    const mock = new MockTransport()
    const agent = new MockTransport()
    const telemetry = createTelemetry({ mode: 'off', transports: { mock, agent } })

    telemetry.send(appStarted())
    telemetry.setMode('mock')
    telemetry.send(tabChanged('Fruit', 'Veggies'))
    telemetry.setMode('agent')
    telemetry.send(tabChanged('Veggies', 'Ice Cream'))

    expect(mock.events).toHaveLength(1)
    expect(agent.events).toHaveLength(1)
    expect(telemetry.mode).toBe('agent')
  })

  it('notifies subscribers when the mode changes', () => {
    const telemetry = createTelemetry({ mode: 'off' })
    const seen: string[] = []
    const unsubscribe = telemetry.onModeChange((mode) => seen.push(mode))

    telemetry.setMode('mock')
    telemetry.setMode('agent')
    unsubscribe()
    telemetry.setMode('off')

    expect(seen).toEqual(['mock', 'agent'])
  })

  it('forwards errors to the transport as error events', () => {
    const mock = new MockTransport()
    const telemetry = createTelemetry({ mode: 'mock', transports: { mock } })

    telemetry.send(cartLimitExceeded(new CartLimitExceededError(26, ['fruit-4'])))

    expect(mock.events[0]).toMatchObject({ kind: 'error', name: 'cart.limit_exceeded' })
  })

  it('never lets a failing transport break the caller', () => {
    const exploding = {
      send: () => {
        throw new Error('network down')
      },
    }
    const onError = vi.fn()
    const telemetry = createTelemetry({
      mode: 'mock',
      transports: { mock: exploding },
      onTransportError: onError,
    })

    expect(() => telemetry.send(appStarted())).not.toThrow()
    expect(onError).toHaveBeenCalledOnce()
  })
})
