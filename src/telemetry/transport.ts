import type { TelemetryEvent } from './events.ts'

export interface Transport {
  send(event: TelemetryEvent): void
}

/** Metric prefix shared by the browser and the BFF so both show up under one namespace. */
export const METRIC_PREFIX = 'ddog'

const STATSD_KIND: Record<TelemetryEvent['kind'], string> = {
  count: 'c',
  gauge: 'g',
  // Errors are counted; the stack goes to RUM / dd-trace, not to StatsD.
  error: 'c',
}

/** DogStatsD forbids spaces, commas and pipes inside tag values. */
function sanitize(value: string): string {
  return value.replace(/[\s,|#:]/g, '_')
}

/** Renders an event in DogStatsD wire format: `name:value|type|#tag:val,tag:val`. */
export function toStatsdLine(event: TelemetryEvent): string {
  const metric = `${METRIC_PREFIX}.${event.name}:${event.value}|${STATSD_KIND[event.kind]}`
  const tags = Object.entries(event.tags)
  if (tags.length === 0) return metric
  return `${metric}|#${tags.map(([k, v]) => `${sanitize(k)}:${sanitize(v)}`).join(',')}`
}
