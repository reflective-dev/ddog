import type { Cart } from '../domain/cart.ts'
import { isChecked } from '../domain/cart.ts'
import { CATALOG, type Category } from '../domain/catalog.ts'
import styles from './Checklist.module.css'

interface ChecklistProps {
  category: Category
  cart: Cart
  onToggle: (id: string) => void
}

export function Checklist({ category, cart, onToggle }: ChecklistProps) {
  return (
    <div
      className={styles.panel}
      role="tabpanel"
      id={`panel-${category}`}
      aria-labelledby={`tab-${category}`}
    >
      <ul className={styles.list}>
        {CATALOG[category].map((item) => (
          <li key={item.id} className={styles.row}>
            <label className={styles.label}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={isChecked(cart, item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span className={styles.name}>{item.name}</span>
              <span className={styles.price}>${item.price}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
