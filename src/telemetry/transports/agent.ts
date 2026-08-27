import type { TelemetryEvent } from '../events.ts'
import type { Transport } from '../transport.ts'

/** The slice of the Datadog RUM SDK this transport needs. */
export interface RumLike {
  addError(error: unknown, context?: Record<string, unknown>): void
  addAction(name: string, context?: Record<string, unknown>): void
}

export interface AgentTransportOptions {
  endpoint?: string
  rum?: RumLike
  onError?: (error: unknown) => void
}

function serializeError(error: Error): { name: string; message: string; stack: string } {
  return { name: error.name, message: error.message, stack: error.stack ?? '' }
}

/**
 * "Agent" — ships telemetry two ways:
 *   1. POST to the BFF, which forwards metrics to the Datadog agent over DogStatsD.
 *   2. Directly to Datadog RUM, which carries browser sessions and error stacks.
 */
export class AgentTransport implements Transport {
  readonly #endpoint: string
  readonly #onError: (error: unknown) => void
  #rum: RumLike | undefined

  constructor({ endpoint = '/api/telemetry', rum, onError }: AgentTransportOptions = {}) {
    this.#endpoint = endpoint
    this.#rum = rum
    this.#onError = onError ?? (() => {})
  }

  /** RUM only boots when the user picks Agent mode, so it is attached after construction. */
  setRum(rum: RumLike | undefined): void {
    this.#rum = rum
  }

  send(event: TelemetryEvent): void {
    this.#toRum(event)
    this.#toBff(event)
  }

  #toRum(event: TelemetryEvent): void {
    if (!this.#rum) return
    if (event.kind === 'error' && event.error) {
      this.#rum.addError(event.error, { ...event.tags, metric: event.name })
    } else {
      this.#rum.addAction(event.name, { ...event.tags, value: event.value })
    }
  }

  #toBff(event: TelemetryEvent): void {
    const payload = {
      name: event.name,
      kind: event.kind,
      value: event.value,
      tags: event.tags,
      ...(event.error ? { error: serializeError(event.error) } : {}),
    }

    // Fire-and-forget: telemetry must never block or break the UI.
    void fetch(this.#endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(this.#onError)
  }
}
