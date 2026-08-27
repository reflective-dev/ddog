export const CATEGORIES = ['Fruit', 'Veggies', 'Ice Cream'] as const

export type Category = (typeof CATEGORIES)[number]

export interface GroceryItem {
  id: string
  name: string
  /** Whole dollars, $5–$10. */
  price: number
  category: Category
}

function build(category: Category, prefix: string, entries: [string, number][]): GroceryItem[] {
  return entries.map(([name, price], index) => ({
    id: `${prefix}-${index + 1}`,
    name,
    price,
    category,
  }))
}

export const CATALOG: Record<Category, GroceryItem[]> = {
  Fruit: build('Fruit', 'fruit', [
    ['Apples', 5],
    ['Bananas', 6],
    ['Blueberries', 9],
    ['Cherries', 10],
    ['Grapes', 7],
    ['Mangoes', 8],
    ['Oranges', 5],
    ['Peaches', 7],
    ['Raspberries', 10],
    ['Strawberries', 8],
  ]),
  Veggies: build('Veggies', 'veg', [
    ['Asparagus', 9],
    ['Broccoli', 6],
    ['Carrots', 5],
    ['Cauliflower', 7],
    ['Cucumbers', 5],
    ['Green Beans', 6],
    ['Kale', 7],
    ['Mushrooms', 8],
    ['Spinach', 8],
    ['Sweet Potatoes', 6],
  ]),
  'Ice Cream': build('Ice Cream', 'ice', [
    ['Butter Pecan', 8],
    ['Chocolate', 7],
    ['Cookie Dough', 9],
    ['Mint Chip', 8],
    ['Neapolitan', 6],
    ['Pistachio', 10],
    ['Rocky Road', 9],
    ['Salted Caramel', 10],
    ['Strawberry', 7],
    ['Vanilla', 6],
  ]),
}

const BY_ID = new Map<string, GroceryItem>(
  CATEGORIES.flatMap((category) => CATALOG[category].map((item) => [item.id, item] as const)),
)

export function itemById(id: string): GroceryItem | undefined {
  return BY_ID.get(id)
}
