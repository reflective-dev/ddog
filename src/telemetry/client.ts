import type { TelemetryEvent } from './events.ts'
import type { Transport } from './transport.ts'
import { OffTransport } from './transports/off.ts'
import { MockTransport } from './transports/mock.ts'
import { AgentTransport } from './transports/agent.ts'

export const MODES = ['off', 'mock', 'agent'] as const
export type Mode = (typeof MODES)[number]

export const MODE_LABELS: Record<Mode, string> = {
  off: 'Off',
  mock: 'Mock',
  agent: 'Agent',
}

export interface TelemetryOptions {
  mode?: Mode
  transports?: Partial<Record<Mode, Transport>>
  onTransportError?: (error: unknown, event: TelemetryEvent) => void
}

export interface Telemetry {
  readonly mode: Mode
  send(event: TelemetryEvent): void
  setMode(mode: Mode): void
  onModeChange(listener: (mode: Mode) => void): () => void
}

export function createTelemetry({
  mode: initialMode = 'off',
  transports = {},
  onTransportError,
}: TelemetryOptions = {}): Telemetry {
  const resolved: Record<Mode, Transport> = {
    off: transports.off ?? new OffTransport(),
    mock: transports.mock ?? new MockTransport(),
    agent: transports.agent ?? new AgentTransport(),
  }

  let mode = initialMode
  const listeners = new Set<(mode: Mode) => void>()

  return {
    get mode() {
      return mode
    },

    send(event) {
      try {
        resolved[mode].send(event)
      } catch (error) {
        // A broken telemetry pipe must never take the app down with it.
        onTransportError?.(error, event)
      }
    },

    setMode(next) {
      if (next === mode) return
      mode = next
      for (const listener of listeners) listener(mode)
    },

    onModeChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
