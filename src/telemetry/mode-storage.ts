import { MODES, type Mode } from './client.ts'

const KEY = 'ddog:mode'

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}

/**
 * The mode survives a reload so that `app.started` — which fires on mount,
 * before anything can be clicked — is actually observable in Mock/Agent mode.
 */
export function loadMode(): Mode {
  try {
    const stored = localStorage.getItem(KEY)
    return isMode(stored) ? stored : 'off'
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Never fatal.
    return 'off'
  }
}

export function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Persisting is a convenience, not a requirement.
  }
}
