import type { TelemetryEvent } from '../events.ts'
import type { Transport } from '../transport.ts'

/** "Off" — the app behaves normally but nothing leaves the page. */
export class OffTransport implements Transport {
  send(_event: TelemetryEvent): void {
    // Intentionally empty.
  }
}
