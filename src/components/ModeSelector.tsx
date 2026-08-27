import { MODES, MODE_LABELS, type Mode } from '../telemetry/client.ts'
import styles from './ModeSelector.module.css'

interface ModeSelectorProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

const HINTS: Record<Mode, string> = {
  off: 'Nothing leaves the page',
  mock: 'Captured locally, below',
  agent: 'Sent to the Datadog agent',
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <fieldset className={styles.fieldset} role="radiogroup" aria-label="Datadog mode">
      <legend className={styles.legend}>Datadog</legend>
      {MODES.map((value) => (
        <label key={value} className={styles.option} title={HINTS[value]}>
          <input
            type="radio"
            name="datadog-mode"
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
          />
          {MODE_LABELS[value]}
        </label>
      ))}
    </fieldset>
  )
}
