import { useEffect, useState } from 'react'
import type { CapturedEvent, MockTransport } from '../telemetry/transports/mock.ts'
import styles from './MockLog.module.css'

interface MockLogProps {
  transport: MockTransport
}

/** Live view of what Mock mode captured — the in-page equivalent of `nc -u -l 8125`. */
export function MockLog({ transport }: MockLogProps) {
  const [events, setEvents] = useState<readonly CapturedEvent[]>(transport.events)

  useEffect(() => {
    setEvents(transport.events)
    return transport.subscribe(() => setEvents(transport.events))
  }, [transport])

  const clear = () => {
    transport.clear()
    setEvents(transport.events)
  }

  return (
    <section className={styles.wrapper} aria-label="Captured telemetry">
      <header className={styles.header}>
        <h2 className={styles.title}>Captured telemetry</h2>
        <span className={styles.count}>{events.length} events</span>
        <button type="button" className={styles.clear} onClick={clear}>
          Clear
        </button>
      </header>
      <ol className={styles.log} data-testid="mock-log">
        {events.length === 0 && <li className={styles.empty}>Nothing captured yet.</li>}
        {[...events].reverse().map((event) => (
          <li key={event.seq} className={styles.line}>
            <span className={styles.seq}>{String(event.seq).padStart(3, '0')}</span>
            <code className={event.kind === 'error' ? styles.errorLine : undefined}>
              {event.statsd}
            </code>
          </li>
        ))}
      </ol>
    </section>
  )
}
