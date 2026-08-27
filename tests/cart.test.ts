import { describe, expect, it } from 'vitest'
import {
  CART_LIMIT,
  CartLimitExceededError,
  assertUnderLimit,
  emptyCart,
  isChecked,
  toggle,
  total,
} from '../src/domain/cart.ts'

describe('cart', () => {
  it('starts empty with a zero total', () => {
    const cart = emptyCart()
    expect(total(cart)).toBe(0)
    expect(isChecked(cart, 'fruit-1')).toBe(false)
  })

  it('checks an item and sums its price', () => {
    const cart = toggle(emptyCart(), 'fruit-1') // Apples, $5
    expect(isChecked(cart, 'fruit-1')).toBe(true)
    expect(total(cart)).toBe(5)
  })

  it('un-checks an item that was checked', () => {
    const cart = toggle(toggle(emptyCart(), 'fruit-1'), 'fruit-1')
    expect(isChecked(cart, 'fruit-1')).toBe(false)
    expect(total(cart)).toBe(0)
  })

  it('does not mutate the cart it is given', () => {
    const before = emptyCart()
    toggle(before, 'fruit-1')
    expect(total(before)).toBe(0)
  })

  it('sums several items across categories', () => {
    let cart = emptyCart()
    for (const id of ['fruit-1', 'veg-3', 'ice-2']) cart = toggle(cart, id) // 5 + 5 + 7
    expect(total(cart)).toBe(17)
  })

  it('ignores unknown ids when totalling', () => {
    const cart = toggle(emptyCart(), 'does-not-exist')
    expect(total(cart)).toBe(0)
  })

  it('caps the limit at $25', () => {
    expect(CART_LIMIT).toBe(25)
  })

  it('allows a total of exactly the limit', () => {
    let cart = emptyCart()
    for (const id of ['fruit-4', 'fruit-9', 'ice-5']) cart = toggle(cart, id) // 10 + 10 + 6 = 26
    cart = toggle(cart, 'ice-5')
    cart = toggle(cart, 'fruit-1') // 10 + 10 + 5 = 25
    expect(total(cart)).toBe(25)
    expect(() => assertUnderLimit(cart)).not.toThrow()
  })

  it('throws once the total goes over the limit', () => {
    let cart = emptyCart()
    for (const id of ['fruit-4', 'fruit-9', 'ice-5']) cart = toggle(cart, id) // 26
    expect(() => assertUnderLimit(cart)).toThrow(CartLimitExceededError)
  })

  it('carries the total, limit and item ids on the thrown error', () => {
    let cart = emptyCart()
    for (const id of ['fruit-4', 'fruit-9', 'ice-5']) cart = toggle(cart, id)

    try {
      assertUnderLimit(cart)
      expect.unreachable('should have thrown')
    } catch (error) {
      const limitError = error as CartLimitExceededError
      expect(limitError).toBeInstanceOf(Error)
      expect(limitError.name).toBe('CartLimitExceededError')
      expect(limitError.total).toBe(26)
      expect(limitError.limit).toBe(25)
      expect(limitError.itemIds).toEqual(['fruit-4', 'fruit-9', 'ice-5'])
      expect(limitError.message).toBe('Cart total $26 exceeds the $25 limit')
    }
  })
})
