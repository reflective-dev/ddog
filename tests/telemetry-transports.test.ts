import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockTransport } from '../src/telemetry/transports/mock.ts'
import { OffTransport } from '../src/telemetry/transports/off.ts'
import { AgentTransport } from '../src/telemetry/transports/agent.ts'
import { appStarted, cartLimitExceeded, tabChanged } from '../src/telemetry/events.ts'
import { CartLimitExceededError } from '../src/domain/cart.ts'

describe('OffTransport', () => {
  it('drops everything on the floor', () => {
    const off = new OffTransport()
    expect(() => off.send(appStarted())).not.toThrow()
  })
})

describe('MockTransport', () => {
  it('records events in order with a monotonic sequence', () => {
    const mock = new MockTransport()
    mock.send(appStarted())
    mock.send(tabChanged('Fruit', 'Veggies'))

    expect(mock.events.map((e) => e.name)).toEqual(['app.started', 'tab.changed'])
    expect(mock.events.map((e) => e.seq)).toEqual([1, 2])
  })

  it('renders each event as a DogStatsD line so nc -u -l 8125 output is comparable', () => {
    const mock = new MockTransport()
    mock.send(appStarted())

    expect(mock.events[0]?.statsd).toBe('ddog.app.started:1|c')
  })

  it('renders tags in DogStatsD form', () => {
    const mock = new MockTransport()
    mock.send(tabChanged('Fruit', 'Ice Cream'))

    expect(mock.events[0]?.statsd).toBe('ddog.tab.changed:1|c|#from:Fruit,to:Ice_Cream')
  })

  it('mirrors events to the console so they are visible in devtools', () => {
    const log = vi.spyOn(console, 'debug').mockImplementation(() => {})
    new MockTransport().send(appStarted())
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it('keeps the captured error on error events', () => {
    const mock = new MockTransport()
    const error = new CartLimitExceededError(26, ['fruit-4'])
    mock.send(cartLimitExceeded(error))

    expect(mock.events[0]?.error).toBe(error)
    expect(mock.events[0]?.statsd).toContain('|c')
  })

  it('caps its buffer so a long session cannot grow without bound', () => {
    const mock = new MockTransport({ limit: 3, mirrorToConsole: false })
    for (let i = 0; i < 5; i += 1) mock.send(appStarted())

    expect(mock.events).toHaveLength(3)
    expect(mock.events.map((e) => e.seq)).toEqual([3, 4, 5])
  })

  it('can be cleared', () => {
    const mock = new MockTransport({ mirrorToConsole: false })
    mock.send(appStarted())
    mock.clear()
    expect(mock.events).toHaveLength(0)
  })

  it('notifies listeners as events arrive', () => {
    const mock = new MockTransport({ mirrorToConsole: false })
    const listener = vi.fn()
    const unsubscribe = mock.subscribe(listener)

    mock.send(appStarted())
    unsubscribe()
    mock.send(appStarted())

    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('AgentTransport', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('POSTs the event to the BFF telemetry endpoint', async () => {
    const agent = new AgentTransport({ endpoint: '/api/telemetry' })
    agent.send(appStarted())
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/telemetry')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(JSON.parse(init.body as string)).toMatchObject({ name: 'app.started', kind: 'count' })
  })

  it('serialises the error into a reportable shape', async () => {
    const agent = new AgentTransport({ endpoint: '/api/telemetry' })
    agent.send(cartLimitExceeded(new CartLimitExceededError(26, ['fruit-4'])))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.error).toMatchObject({
      name: 'CartLimitExceededError',
      message: 'Cart total $26 exceeds the $25 limit',
    })
    expect(typeof body.error.stack).toBe('string')
  })

  it('reports the error to RUM when a RUM client is present', () => {
    const addError = vi.fn()
    const addAction = vi.fn()
    const agent = new AgentTransport({ endpoint: '/api/telemetry', rum: { addError, addAction } })
    const error = new CartLimitExceededError(26, ['fruit-4'])

    agent.send(cartLimitExceeded(error))

    expect(addError).toHaveBeenCalledWith(error, expect.objectContaining({ cart_total: '26' }))
  })

  it('reports non-error events to RUM as custom actions', () => {
    const addError = vi.fn()
    const addAction = vi.fn()
    const agent = new AgentTransport({ endpoint: '/api/telemetry', rum: { addError, addAction } })

    agent.send(tabChanged('Fruit', 'Veggies'))

    expect(addAction).toHaveBeenCalledWith(
      'tab.changed',
      expect.objectContaining({ from: 'Fruit', to: 'Veggies' }),
    )
    expect(addError).not.toHaveBeenCalled()
  })

  it('accepts a RUM client attached after construction', () => {
    const agent = new AgentTransport({ endpoint: '/api/telemetry' })
    const addAction = vi.fn()
    agent.setRum({ addError: vi.fn(), addAction })

    agent.send(tabChanged('Fruit', 'Veggies'))

    expect(addAction).toHaveBeenCalledOnce()
  })

  it('goes back to BFF-only when the RUM client is detached', () => {
    const addAction = vi.fn()
    const agent = new AgentTransport({
      endpoint: '/api/telemetry',
      rum: { addError: vi.fn(), addAction },
    })
    agent.setRum(undefined)

    agent.send(tabChanged('Fruit', 'Veggies'))

    expect(addAction).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('swallows network failures rather than surfacing them to the UI', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const onError = vi.fn()
    const agent = new AgentTransport({ endpoint: '/api/telemetry', onError })

    expect(() => agent.send(appStarted())).not.toThrow()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})
