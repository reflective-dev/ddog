import { describe, expect, it } from 'vitest'
import { CATALOG, CATEGORIES, itemById } from '../src/domain/catalog.ts'

describe('catalog', () => {
  it('exposes exactly the three grocery categories in order', () => {
    expect(CATEGORIES).toEqual(['Fruit', 'Veggies', 'Ice Cream'])
  })

  it('has 10 items in every category', () => {
    for (const category of CATEGORIES) {
      expect(CATALOG[category]).toHaveLength(10)
    }
  })

  it('prices every item in whole dollars from $5 to $10', () => {
    for (const category of CATEGORIES) {
      for (const item of CATALOG[category]) {
        expect(Number.isInteger(item.price)).toBe(true)
        expect(item.price).toBeGreaterThanOrEqual(5)
        expect(item.price).toBeLessThanOrEqual(10)
      }
    }
  })

  it('gives every item a unique id and a non-empty name', () => {
    const ids = CATEGORIES.flatMap((c) => CATALOG[c].map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(30)

    for (const category of CATEGORIES) {
      for (const item of CATALOG[category]) {
        expect(item.name.length).toBeGreaterThan(0)
        expect(item.category).toBe(category)
      }
    }
  })

  it('looks up an item by id', () => {
    const apple = itemById('fruit-1')
    expect(apple).toMatchObject({ id: 'fruit-1', category: 'Fruit' })
  })

  it('returns undefined for an unknown id', () => {
    expect(itemById('nope')).toBeUndefined()
  })
})
