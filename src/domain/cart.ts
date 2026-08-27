import { itemById } from './catalog.ts'

/** Checking past this dollar amount is an error worth reporting to Datadog. */
export const CART_LIMIT = 25

/** The set of checked item ids. Treated as immutable — every helper returns a new cart. */
export type Cart = ReadonlySet<string>

export function emptyCart(): Cart {
  return new Set<string>()
}

export function isChecked(cart: Cart, id: string): boolean {
  return cart.has(id)
}

export function toggle(cart: Cart, id: string): Cart {
  const next = new Set(cart)
  if (!next.delete(id)) next.add(id)
  return next
}

export function total(cart: Cart): number {
  let sum = 0
  for (const id of cart) sum += itemById(id)?.price ?? 0
  return sum
}

export class CartLimitExceededError extends Error {
  readonly total: number
  readonly limit: number
  readonly itemIds: string[]

  constructor(total: number, itemIds: string[], limit: number = CART_LIMIT) {
    super(`Cart total $${total} exceeds the $${limit} limit`)
    this.name = 'CartLimitExceededError'
    this.total = total
    this.limit = limit
    this.itemIds = itemIds
  }
}

/** Throws {@link CartLimitExceededError} when the cart total is strictly over the limit. */
export function assertUnderLimit(cart: Cart): void {
  const sum = total(cart)
  if (sum > CART_LIMIT) {
    throw new CartLimitExceededError(sum, [...cart].sort())
  }
}
