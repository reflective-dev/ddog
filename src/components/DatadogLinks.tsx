import { datadogLinks, type LinksEnv } from '../telemetry/dd-links.ts'
import styles from './DatadogLinks.module.css'

interface DatadogLinksProps {
  env: LinksEnv
}

/**
 * Shown only in Agent mode — the counterpart to the Mock inspector. Mock shows
 * what was captured locally; this shows where the data actually went.
 */
export function DatadogLinks({ env }: DatadogLinksProps) {
  return (
    <section className={styles.wrapper} aria-label="View in Datadog">
      <header className={styles.header}>
        <h2 className={styles.title}>View in Datadog</h2>
        <span className={styles.hint}>Data can take a minute or two to appear</span>
      </header>
      <ul className={styles.list} data-testid="dd-links">
        {datadogLinks(env).map((link) => (
          <li key={link.label}>
            <a
              className={styles.link}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.label}>{link.label}</span>
              <span className={styles.description}>{link.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
