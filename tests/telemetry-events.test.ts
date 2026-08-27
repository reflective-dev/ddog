import { describe, expect, it } from 'vitest'
import {
  appStarted,
  cartLimitExceeded,
  itemChecked,
  itemUnchecked,
  tabChanged,
} from '../src/telemetry/events.ts'
import { CartLimitExceededError } from '../src/domain/cart.ts'

describe('telemetry events', () => {
  it('describes app start', () => {
    expect(appStarted()).toEqual({
      name: 'app.started',
      kind: 'count',
      value: 1,
      tags: {},
    })
  })

  it('describes a tab change with both tabs as tags', () => {
    expect(tabChanged('Fruit', 'Ice Cream')).toEqual({
      name: 'tab.changed',
      kind: 'count',
      value: 1,
      tags: { from: 'Fruit', to: 'Ice Cream' },
    })
  })

  it('describes checking an item, carrying price and total as tags', () => {
    expect(itemChecked('fruit-1', 'Apples', 'Fruit', 5, 5)).toEqual({
      name: 'item.checked',
      kind: 'count',
      value: 1,
      tags: {
        item_id: 'fruit-1',
        item_name: 'Apples',
        category: 'Fruit',
        price: '5',
        cart_total: '5',
      },
    })
  })

  it('describes un-checking an item', () => {
    const event = itemUnchecked('veg-3', 'Carrots', 'Veggies', 5, 0)
    expect(event.name).toBe('item.unchecked')
    expect(event.tags).toMatchObject({ item_id: 'veg-3', cart_total: '0' })
  })

  it('describes the cart limit error with the error attached', () => {
    const error = new CartLimitExceededError(26, ['fruit-4', 'fruit-9', 'ice-5'])
    const event = cartLimitExceeded(error)

    expect(event).toMatchObject({
      name: 'cart.limit_exceeded',
      kind: 'error',
      value: 26,
      tags: { limit: '25', cart_total: '26', item_count: '3' },
    })
    expect(event.error).toBe(error)
  })
})
