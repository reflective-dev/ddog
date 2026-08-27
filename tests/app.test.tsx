import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App.tsx'
import { createTelemetry } from '../src/telemetry/client.ts'
import { MockTransport } from '../src/telemetry/transports/mock.ts'
import { CATALOG } from '../src/domain/catalog.ts'

function setup(mode: 'off' | 'mock' | 'agent' = 'mock') {
  const captured = new MockTransport({ mirrorToConsole: false })
  const telemetry = createTelemetry({
    mode,
    transports: { mock: captured, agent: captured },
  })
  const user = userEvent.setup()
  render(<App telemetry={telemetry} />)
  return { user, captured, telemetry }
}

const names = (captured: MockTransport) => captured.events.map((e) => e.name)

describe('App — tabs', () => {
  it('renders the three category tabs', () => {
    setup()
    const tablist = screen.getByRole('tablist', { name: /categories/i })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Fruit', 'Veggies', 'Ice Cream'])
  })

  it('opens on Fruit with its 10 items', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'Fruit' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('checkbox')).toHaveLength(10)
    expect(screen.getByRole('checkbox', { name: /Apples/ })).toBeInTheDocument()
  })

  it('shows the other category once a tab is clicked', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: 'Veggies' }))

    expect(screen.getByRole('tab', { name: 'Veggies' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: /Broccoli/ })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Apples/ })).not.toBeInTheDocument()
  })

  it('shows every item with a whole-dollar price', () => {
    setup()
    for (const item of CATALOG.Fruit) {
      expect(screen.getByRole('checkbox', { name: `${item.name} $${item.price}` })).toBeVisible()
    }
  })

  it('keeps checked items checked when returning to a tab', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))
    await user.click(screen.getByRole('tab', { name: 'Veggies' }))
    await user.click(screen.getByRole('tab', { name: 'Fruit' }))

    expect(screen.getByRole('checkbox', { name: /Apples/ })).toBeChecked()
  })
})

describe('App — telemetry', () => {
  it('sends app.started exactly once on mount', () => {
    const { captured } = setup()
    expect(names(captured)).toEqual(['app.started'])
  })

  it('sends tab.changed with the previous and next tab', async () => {
    const { user, captured } = setup()
    await user.click(screen.getByRole('tab', { name: 'Ice Cream' }))

    const event = captured.events.at(-1)
    expect(event?.name).toBe('tab.changed')
    expect(event?.tags).toMatchObject({ from: 'Fruit', to: 'Ice Cream' })
  })

  it('does not send tab.changed when the active tab is re-clicked', async () => {
    const { user, captured } = setup()
    await user.click(screen.getByRole('tab', { name: 'Fruit' }))
    expect(names(captured)).toEqual(['app.started'])
  })

  it('sends item.checked with price and running total', async () => {
    const { user, captured } = setup()
    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))

    const event = captured.events.at(-1)
    expect(event?.name).toBe('item.checked')
    expect(event?.tags).toMatchObject({ item_name: 'Apples', price: '5', cart_total: '5' })
  })

  it('sends item.unchecked when an item is un-checked', async () => {
    const { user, captured } = setup()
    const apples = screen.getByRole('checkbox', { name: /Apples/ })
    await user.click(apples)
    await user.click(apples)

    const event = captured.events.at(-1)
    expect(event?.name).toBe('item.unchecked')
    expect(event?.tags).toMatchObject({ item_name: 'Apples', cart_total: '0' })
  })

  it('sends nothing in off mode', async () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'off', transports: { mock: captured } })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} />)

    await user.click(screen.getByRole('tab', { name: 'Veggies' }))
    expect(captured.events).toHaveLength(0)
  })
})

describe('App — datadog mode selector', () => {
  it('renders the three radio buttons with Off selected by default', () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    render(<App telemetry={createTelemetry({ mode: 'off', transports: { mock: captured } })} />)

    const group = screen.getByRole('radiogroup', { name: /datadog/i })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['off', 'mock', 'agent'])
    expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked()
  })

  it('switches the telemetry mode when a radio is selected', async () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'off', transports: { mock: captured } })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} />)

    await user.click(screen.getByRole('radio', { name: 'Mock' }))

    expect(telemetry.mode).toBe('mock')
    expect(screen.getByRole('radio', { name: 'Mock' })).toBeChecked()
  })

  it('starts sending once switched from Off to Mock', async () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'off', transports: { mock: captured } })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} />)

    await user.click(screen.getByRole('radio', { name: 'Mock' }))
    await user.click(screen.getByRole('tab', { name: 'Veggies' }))

    expect(names(captured)).toEqual(['tab.changed'])
  })
})

describe('App — cart limit', () => {
  // Cherries $10 + Raspberries $10 + Blueberries $9 = $29, over the $25 limit.
  const overLimit = [/Cherries/, /Raspberries/, /Blueberries/]

  it('shows the running total', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$5')
  })

  it('shows no error banner while at or under the limit', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('checkbox', { name: /Cherries/ }))
    await user.click(screen.getByRole('checkbox', { name: /Raspberries/ }))

    expect(screen.getByTestId('cart-total')).toHaveTextContent('$20')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error banner once the total goes over $25', async () => {
    const { user } = setup()
    for (const name of overLimit) await user.click(screen.getByRole('checkbox', { name }))

    expect(screen.getByRole('alert')).toHaveTextContent('Cart total $29 exceeds the $25 limit')
  })

  it('sends the error to datadog with the error attached', async () => {
    const { user, captured } = setup()
    for (const name of overLimit) await user.click(screen.getByRole('checkbox', { name }))

    const event = captured.events.at(-1)
    expect(event?.name).toBe('cart.limit_exceeded')
    expect(event?.kind).toBe('error')
    expect(event?.error).toBeInstanceOf(Error)
    expect(event?.tags).toMatchObject({ cart_total: '29', limit: '25' })
  })

  it('keeps the app usable so the user can recover by un-checking', async () => {
    const { user } = setup()
    for (const name of overLimit) await user.click(screen.getByRole('checkbox', { name }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Blueberries/ }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$20')
  })

  it('still records the item.checked event that crossed the limit', async () => {
    const { user, captured } = setup()
    for (const name of overLimit) await user.click(screen.getByRole('checkbox', { name }))

    expect(names(captured)).toEqual([
      'app.started',
      'item.checked',
      'item.checked',
      'item.checked',
      'cart.limit_exceeded',
    ])
  })

  it('reports again when the limit is crossed a second time', async () => {
    const { user, captured } = setup()
    for (const name of overLimit) await user.click(screen.getByRole('checkbox', { name }))
    await user.click(screen.getByRole('checkbox', { name: /Blueberries/ }))
    await user.click(screen.getByRole('checkbox', { name: /Blueberries/ }))

    expect(names(captured).filter((n) => n === 'cart.limit_exceeded')).toHaveLength(2)
  })
})

describe('App — mock inspector', () => {
  it('lists captured events in mock mode', async () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'mock', transports: { mock: captured } })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} mockTransport={captured} />)

    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))

    const log = screen.getByTestId('mock-log')
    expect(within(log).getByText(/ddog\.item\.checked:1\|c/)).toBeInTheDocument()
  })

  it('hides the inspector when not in mock mode', () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'off', transports: { mock: captured } })
    render(<App telemetry={telemetry} mockTransport={captured} />)

    expect(screen.queryByTestId('mock-log')).not.toBeInTheDocument()
  })

  it('clears captured events on request', async () => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({ mode: 'mock', transports: { mock: captured } })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} mockTransport={captured} />)

    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))
    await user.click(screen.getByRole('button', { name: /clear/i }))

    expect(within(screen.getByTestId('mock-log')).queryByText(/item\.checked/)).toBeNull()
  })
})

describe('App — Datadog links', () => {
  const renderInMode = (mode: 'off' | 'mock' | 'agent') => {
    const captured = new MockTransport({ mirrorToConsole: false })
    const telemetry = createTelemetry({
      mode,
      transports: { mock: captured, agent: captured },
    })
    render(<App telemetry={telemetry} />)
    return { user: userEvent.setup() }
  }

  it('shows links to Datadog in agent mode', () => {
    renderInMode('agent')
    const panel = screen.getByTestId('dd-links')
    expect(within(panel).getByRole('link', { name: /RUM Explorer/ })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /Error Tracking/ })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /APM Traces/ })).toBeInTheDocument()
  })

  it('hides them in off and mock mode, where nothing reaches Datadog', () => {
    renderInMode('off')
    expect(screen.queryByTestId('dd-links')).not.toBeInTheDocument()
    cleanup()
    renderInMode('mock')
    expect(screen.queryByTestId('dd-links')).not.toBeInTheDocument()
  })

  it('opens the links in a new tab safely', () => {
    renderInMode('agent')
    for (const link of within(screen.getByTestId('dd-links')).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
    }
  })

  it('appears as soon as the user switches to Agent', async () => {
    const { user } = renderInMode('mock')
    expect(screen.queryByTestId('dd-links')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Agent' }))

    expect(screen.getByTestId('dd-links')).toBeInTheDocument()
  })
})

describe('App — telemetry failures', () => {
  it('renders normally even when the transport throws', async () => {
    const telemetry = createTelemetry({
      mode: 'mock',
      transports: {
        mock: {
          send() {
            throw new Error('pipe broken')
          },
        },
      },
      onTransportError: vi.fn(),
    })
    const user = userEvent.setup()
    render(<App telemetry={telemetry} />)

    await user.click(screen.getByRole('checkbox', { name: /Apples/ }))
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$5')
  })
})
