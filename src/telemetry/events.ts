import type { Category } from '../domain/catalog.ts'
import type { CartLimitExceededError } from '../domain/cart.ts'

export type EventKind = 'count' | 'gauge' | 'error'

export interface TelemetryEvent {
  name: string
  kind: EventKind
  value: number
  tags: Record<string, string>
  /** Present on `kind: 'error'` events so transports can report the real stack. */
  error?: Error
}

export function appStarted(): TelemetryEvent {
  return { name: 'app.started', kind: 'count', value: 1, tags: {} }
}

export function tabChanged(from: Category, to: Category): TelemetryEvent {
  return { name: 'tab.changed', kind: 'count', value: 1, tags: { from, to } }
}

function itemEvent(
  name: 'item.checked' | 'item.unchecked',
  id: string,
  itemName: string,
  category: Category,
  price: number,
  cartTotal: number,
): TelemetryEvent {
  return {
    name,
    kind: 'count',
    value: 1,
    tags: {
      item_id: id,
      item_name: itemName,
      category,
      price: String(price),
      cart_total: String(cartTotal),
    },
  }
}

export function itemChecked(
  id: string,
  itemName: string,
  category: Category,
  price: number,
  cartTotal: number,
): TelemetryEvent {
  return itemEvent('item.checked', id, itemName, category, price, cartTotal)
}

export function itemUnchecked(
  id: string,
  itemName: string,
  category: Category,
  price: number,
  cartTotal: number,
): TelemetryEvent {
  return itemEvent('item.unchecked', id, itemName, category, price, cartTotal)
}

export function cartLimitExceeded(error: CartLimitExceededError): TelemetryEvent {
  return {
    name: 'cart.limit_exceeded',
    kind: 'error',
    value: error.total,
    tags: {
      limit: String(error.limit),
      cart_total: String(error.total),
      item_count: String(error.itemIds.length),
    },
    error,
  }
}
