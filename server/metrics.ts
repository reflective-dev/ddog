export type Tags = Record<string, string>

/** Where the BFF puts metrics. Swapped for a fake in tests. */
export interface MetricsSink {
  increment(name: string, value: number, tags: Tags): void
  gauge(name: string, value: number, tags: Tags): void
  reportError(error: Error, tags: Tags): void
  close(): Promise<void>
}

/** The slice of `hot-shots` we use. */
export interface StatsdClient {
  increment(name: string, value: number, tags: string[]): void
  gauge(name: string, value: number, tags: string[]): void
  close(callback: (error?: Error) => void): void
}

/** The slice of `dd-trace` we use. */
export interface TracerLike {
  scope(): { active(): { setTag(key: string, value: unknown): void } | null }
}

/**
 * DogStatsD reserves spaces, commas, pipes, hashes and colons inside tag
 * values. Mirrors `sanitize` in src/telemetry/transport.ts so that a category
 * like "Ice Cream" is tagged identically in Mock mode and at the agent.
 */
function sanitize(value: string): string {
  return value.replace(/[\s,|#:]/g, '_')
}

/** hot-shots takes tags as `key:value` strings. */
export function formatTags(tags: Tags): string[] {
  return Object.entries(tags).map(([key, value]) => `${sanitize(key)}:${sanitize(value)}`)
}

export class StatsdSink implements MetricsSink {
  readonly #client: StatsdClient
  readonly #tracer: TracerLike | undefined

  constructor(client: StatsdClient, tracer?: TracerLike) {
    this.#client = client
    this.#tracer = tracer
  }

  increment(name: string, value: number, tags: Tags): void {
    this.#client.increment(name, value, formatTags(tags))
  }

  gauge(name: string, value: number, tags: Tags): void {
    this.#client.gauge(name, value, formatTags(tags))
  }

  reportError(error: Error, tags: Tags): void {
    // Attach to the active APM span so the error shows up on the trace...
    const span = this.#tracer?.scope().active()
    if (span) {
      span.setTag('error', error)
      for (const [key, value] of Object.entries(tags)) span.setTag(key, value)
    }
    // ...and count it so it is alertable as a metric too.
    this.increment('ddog.errors', 1, { error_type: error.name })
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#client.close((error) => (error ? reject(error) : resolve()))
    })
  }
}
