import { CATEGORIES, type Category } from '../domain/catalog.ts'
import styles from './Tabs.module.css'

interface TabsProps {
  active: Category
  onChange: (category: Category) => void
}

export function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className={styles.tablist} role="tablist" aria-label="Grocery categories">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          role="tab"
          id={`tab-${category}`}
          aria-selected={category === active}
          aria-controls={`panel-${category}`}
          className={category === active ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onChange(category)}
        >
          {category}
        </button>
      ))}
    </div>
  )
}
