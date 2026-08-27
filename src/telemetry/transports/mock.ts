import type { TelemetryEvent } from '../events.ts'
import { type Transport, toStatsdLine } from '../transport.ts'

export interface CapturedEvent extends TelemetryEvent {
  /** 1-based arrival order, preserved even after older events are evicted. */
  seq: number
  /** The DogStatsD line this event would put on the wire. */
  statsd: string
}

export interface MockTransportOptions {
  /** Maximum events retained in memory. Older events are evicted first. */
  limit?: number
  mirrorToConsole?: boolean
}

type Listener = (event: CapturedEvent) => void

/**
 * "Mock" — captures telemetry in the page instead of shipping it, so the
 * payloads can be inspected in the UI and compared against `nc -u -l 8125`.
 */
export class MockTransport implements Transport {
  readonly #limit: number
  readonly #mirrorToConsole: boolean
  readonly #listeners = new Set<Listener>()
  #events: CapturedEvent[] = []
  #seq = 0

  constructor({ limit = 200, mirrorToConsole = true }: MockTransportOptions = {}) {
    this.#limit = limit
    this.#mirrorToConsole = mirrorToConsole
  }

  get events(): readonly CapturedEvent[] {
    return this.#events
  }

  send(event: TelemetryEvent): void {
    this.#seq += 1
    const captured: CapturedEvent = { ...event, seq: this.#seq, statsd: toStatsdLine(event) }

    this.#events = [...this.#events, captured].slice(-this.#limit)

    if (this.#mirrorToConsole) {
      console.debug(`[ddog:mock] ${captured.statsd}`, captured.error ?? '')
    }
    for (const listener of this.#listeners) listener(captured)
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  clear(): void {
    this.#events = []
  }
}
