import { useEffect, useRef, useState } from 'react'
import { Tabs } from './components/Tabs.tsx'
import { Checklist } from './components/Checklist.tsx'
import { ModeSelector } from './components/ModeSelector.tsx'
import { MockLog } from './components/MockLog.tsx'
import { DatadogLinks } from './components/DatadogLinks.tsx'
import type { LinksEnv } from './telemetry/dd-links.ts'
import { CATEGORIES, type Category, itemById } from './domain/catalog.ts'
import {
  CART_LIMIT,
  type Cart,
  CartLimitExceededError,
  assertUnderLimit,
  emptyCart,
  isChecked,
  toggle,
  total,
} from './domain/cart.ts'
import type { Mode, Telemetry } from './telemetry/client.ts'
import type { MockTransport } from './telemetry/transports/mock.ts'
import {
  appStarted,
  cartLimitExceeded,
  itemChecked,
  itemUnchecked,
  tabChanged,
} from './telemetry/events.ts'
import styles from './App.module.css'

const FIRST_TAB: Category = CATEGORIES[0]

interface AppProps {
  telemetry: Telemetry
  mockTransport?: MockTransport
  /** Supplies the Datadog site and service used to build the "View in Datadog" links. */
  env?: LinksEnv
}

export function App({ telemetry, mockTransport, env = {} }: AppProps) {
  const [activeTab, setActiveTab] = useState<Category>(FIRST_TAB)
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [mode, setMode] = useState<Mode>(telemetry.mode)
  const [limitError, setLimitError] = useState<CartLimitExceededError | null>(null)

  const started = useRef(false)
  useEffect(() => {
    // StrictMode double-invokes effects in dev; app.started must still be sent once.
    if (started.current) return
    started.current = true
    telemetry.send(appStarted())
  }, [telemetry])

  const changeTab = (next: Category) => {
    if (next === activeTab) return
    setActiveTab(next)
    telemetry.send(tabChanged(activeTab, next))
  }

  const changeMode = (next: Mode) => {
    telemetry.setMode(next)
    setMode(next)
  }

  const toggleItem = (id: string) => {
    const item = itemById(id)
    if (!item) return

    const wasChecked = isChecked(cart, id)
    const next = toggle(cart, id)
    const nextTotal = total(next)
    setCart(next)

    telemetry.send(
      wasChecked
        ? itemUnchecked(item.id, item.name, item.category, item.price, nextTotal)
        : itemChecked(item.id, item.name, item.category, item.price, nextTotal),
    )

    try {
      assertUnderLimit(next)
      setLimitError(null)
    } catch (error) {
      // Thrown for real, then caught here so the cart stays usable and the
      // user can recover by un-checking something.
      const limitExceeded = error as CartLimitExceededError
      telemetry.send(cartLimitExceeded(limitExceeded))
      setLimitError(limitExceeded)
    }
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>ddog groceries</h1>
          <p className={styles.subtitle}>
            Check items to build a cart. Going over ${CART_LIMIT} raises an error.
          </p>
        </div>
        <ModeSelector mode={mode} onChange={changeMode} />
      </header>

      {limitError && (
        <div className={styles.banner} role="alert">
          <strong>Over budget.</strong> {limitError.message} — un-check something to recover.
        </div>
      )}

      <Tabs active={activeTab} onChange={changeTab} />
      <Checklist category={activeTab} cart={cart} onToggle={toggleItem} />

      <footer className={styles.footer}>
        <span className={styles.totalLabel}>Cart total</span>
        <span
          className={limitError ? `${styles.total} ${styles.over}` : styles.total}
          data-testid="cart-total"
        >
          ${total(cart)}
        </span>
        <span className={styles.limit}>/ ${CART_LIMIT} limit</span>
      </footer>

      {mode === 'mock' && mockTransport && <MockLog transport={mockTransport} />}
      {mode === 'agent' && <DatadogLinks env={env} />}
    </main>
  )
}
